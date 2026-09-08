function localDateString() {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60_000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
}

// OOP + ENCAPSULATION: this class groups scheduling behavior with its data.
// The #availability and #bookings fields are private, so outside code cannot change them directly.
class Scheduler {
  #availability = new Map();
  #bookings = [];

  constructor() {
    this.#availability.set(localDateString(), { start: "08:00", end: "18:00" });
  }

  publish(date, start, end) {
    if (!date || !start || !end) throw new Error("Please complete the date and both hours.");
    if (start >= end) throw new Error("The end time needs to be after the start time.");
    if (this.#toMinutes(end) - this.#toMinutes(start) < 60) throw new Error("Availability must include at least one hour.");
    this.#availability.set(date, { start, end });
  }

  availableDates() { return [...this.#availability.keys()].sort(); }

  // HIGHER-ORDER FUNCTION + LAMBDA EXPRESSION: map transforms each date into a schedule object.
  allAvailability() { return this.availableDates().map(date => ({ date, ...this.#availability.get(date) })); }

  slotsFor(date) {
    const hours = this.#availability.get(date);
    if (!hours) return [];

    const slots = [];
    for (let minutes = this.#toMinutes(hours.start); minutes + 60 <= this.#toMinutes(hours.end); minutes += 60) {
      const time = this.#toTime(minutes);
      // HIGHER-ORDER FUNCTION + LAMBDA EXPRESSION: find checks bookings with an arrow callback.
      const booking = this.#bookings.find(item => item.date === date && (item.time === time || item.restTime === time));
      slots.push({ time, state: booking ? (booking.time === time ? "booked" : "rest") : "open" });
    }
    return slots;
  }

  book(date, time, details) {
    const chosenSlot = this.slotsFor(date).find(slot => slot.time === time);
    if (!chosenSlot || chosenSlot.state !== "open") throw new Error("That time is no longer available. Please choose another one.");
    const booking = { ...details, id: crypto.randomUUID(), date, time, restTime: this.#toTime(this.#toMinutes(time) + 60) };
    this.#bookings.push(booking);
    return booking;
  }

  bookings() { return [...this.#bookings].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)); }
  findByReference(reference) { return this.#bookings.find(booking => booking.referenceCode === reference.trim().toUpperCase()); }
  #toMinutes(time) { const [hours, minutes] = time.split(":").map(Number); return hours * 60 + minutes; }
  #toTime(minutes) { return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`; }
}

// THREADS / CONCURRENCY: a Web Worker runs time-label formatting on a background thread.
// The Promise callbacks reconnect its concurrent results to the user interface.
const workerSource = `onmessage = event => { const [id, time] = event.data; let [hour, minute] = time.split(':').map(Number); const period = hour >= 12 ? 'PM' : 'AM'; hour = hour % 12 || 12; postMessage([id, hour + ':' + String(minute).padStart(2, '0') + ' ' + period]); };`;
const clockWorker = new Worker(URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" })));
const pendingLabels = new Map();
let workerId = 0;
clockWorker.onmessage = event => { const [id, label] = event.data; pendingLabels.get(id)?.(label); pendingLabels.delete(id); };
const formatTime = time => new Promise(resolve => { const id = workerId++; pendingLabels.set(id, resolve); clockWorker.postMessage([id, time]); });

const scheduler = new Scheduler();
const $ = selector => document.querySelector(selector);
const prettyDate = date => new Intl.DateTimeFormat("en-PH", { month: "long", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`));

let role = null;
let authMode = "login";
let customerDetails = null;
let selectedDate = null;
let selectedTime = null;

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3600);
}

function createReferenceCode() {
  return `PAW-${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

function createVisitSummary(details) {
  const visitType = details.types.join(", ");
  return `${details.petName} is a ${details.petType} scheduled for ${visitType}. The intake was submitted by ${details.ownerName}; contact details and address are on file. Confirm the pet's current condition, history, and any clinic-specific consent requirements during the visit.`;
}

function openModal(id) { $(`#${id}`).classList.remove("hidden"); }
function closeModal(id) { $(`#${id}`).classList.add("hidden"); }

function openAuth(nextRole) {
  role = nextRole;
  setAuthMode("login");
  const name = role === "doctor" ? "veterinarian" : "pet parent";
  $("#authEyebrow").textContent = `${name.toUpperCase()} ACCOUNT`;
  $("#authTitle").textContent = `Welcome, ${name}.`;
  $("#authDescription").textContent = "Sign in to your account or create one to continue.";
  openModal("authModal");
}

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll(".auth-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.mode === mode));
  $("#authSubmit").innerHTML = `${mode === "login" ? "Sign in" : "Create account"} <span>→</span>`;
}

function enterPortal() {
  closeModal("authModal");
  $("#landing").classList.add("hidden");
  $("#app").classList.remove("hidden");
  $("#signOut").classList.remove("hidden");
  $("#backHome").classList.remove("hidden");
  $("#viewTitle").innerHTML = `<span class="pulse"></span>${role === "doctor" ? "Veterinarian portal" : "Pet parent portal"}`;
  $("#doctorView").classList.toggle("hidden", role !== "doctor");
  $("#customerView").classList.toggle("hidden", role !== "customer");
  if (role === "doctor") renderDoctor();
}

function renderDoctor() {
  const availability = scheduler.allAvailability();
  $("#doctorScheduleList").innerHTML = availability.map(item => `
    <div class="schedule-item"><div><b>${prettyDate(item.date)}</b><span>${item.start} — ${item.end}</span></div><span class="tag">Live</span></div>
  `).join("") || '<p class="empty">No availability published yet.</p>';

  const bookings = scheduler.bookings();
  $("#bookingList").innerHTML = bookings.map(item => `
    <div class="booking-item"><div><b>${item.petName} <small>with ${item.ownerName}</small></b><small>${prettyDate(item.date)} · ${item.time} · ${item.types.join(", ")} · ${item.referenceCode}</small></div><span class="tag">Confirmed</span></div>
  `).join("") || '<p class="empty">Your confirmed appointments will appear here.</p>';
}

async function renderScheduleModal() {
  const dates = scheduler.availableDates();
  if (!dates.length) {
    $("#slotDates").innerHTML = "";
    $("#slotList").innerHTML = '<p class="empty">No appointment windows have been published yet.</p>';
    return;
  }

  selectedDate = dates.includes(selectedDate) ? selectedDate : dates[0];
  $("#slotDates").innerHTML = dates.map(date => `<button class="date-tab ${date === selectedDate ? "active" : ""}" data-date="${date}">${prettyDate(date)}</button>`).join("");
  $("#slotDates").querySelectorAll("button").forEach(button => button.addEventListener("click", () => {
    selectedDate = button.dataset.date;
    selectedTime = null;
    $("#submitBooking").disabled = true;
    $("#selectedSlotMessage").textContent = "Select a time to continue.";
    renderScheduleModal();
  }));

  // HIGHER-ORDER FUNCTION + LAMBDA EXPRESSION: filter keeps only customer-visible open slots.
  // Booked slots and doctor rest periods are private.
  const slots = scheduler.slotsFor(selectedDate).filter(slot => slot.state === "open");
  const buttons = await Promise.all(slots.map(async slot => `<button class="slot ${slot.time === selectedTime ? "selected" : ""}" data-time="${slot.time}">${await formatTime(slot.time)}</button>`));
  $("#slotList").innerHTML = buttons.join("") || '<p class="empty">No available appointment times remain for this date.</p>';
  $("#slotList").querySelectorAll(".slot").forEach(button => button.addEventListener("click", () => selectTime(button.dataset.time)));
}

async function selectTime(time) {
  selectedTime = time;
  $("#selectedSlotMessage").textContent = `Selected: ${prettyDate(selectedDate)} at ${await formatTime(time)}`;
  $("#submitBooking").disabled = false;
  renderScheduleModal();
}

function submitBooking() {
  // EXCEPTION HANDLING: booking conflicts are caught so the screen can show a helpful message.
  try {
    const booking = scheduler.book(selectedDate, selectedTime, { ...customerDetails, referenceCode: createReferenceCode(), summary: createVisitSummary(customerDetails) });
    closeModal("scheduleModal");
    showConfirmation(booking);
    $("#petForm").reset();
    $("#otherPetField").classList.add("hidden");
    $("#otherPetType").required = false;
    customerDetails = null;
    selectedTime = null;
  } catch (error) {
    showToast(error.message);
    renderScheduleModal();
  }
}

function showConfirmation(booking) {
  $("#referenceCode").textContent = booking.referenceCode;
  $("#confirmationDetails").innerHTML = `<b>${booking.petName}</b> (${booking.petType}) · ${prettyDate(booking.date)} at ${booking.time}<br>Appointment type: ${booking.types.join(", ")}`;
  $("#confirmationReport").textContent = booking.summary;
  openModal("confirmationModal");
}

function renderLookup(booking) {
  const result = $("#lookupResult");
  if (!booking) {
    result.innerHTML = '<p class="form-message">No appointment matched that reference code.</p>';
    return;
  }
  result.innerHTML = `<div class="schedule-item"><div><b>${booking.petName} <small>with ${booking.ownerName}</small></b><span>${prettyDate(booking.date)} · ${booking.time} · ${booking.referenceCode}</span></div><span class="tag">Verified</span></div><div class="report-box"><b>Customer intake</b><p>Owner: ${booking.ownerName}<br>Pet type: ${booking.petType}<br>Address: ${booking.address}<br>Contact: ${booking.contact}<br>Appointment type: ${booking.types.join(", ")}</p></div><div class="report-box"><b>Visit summary report</b><p>${booking.summary}</p></div>`;
}

document.querySelectorAll("[data-role]").forEach(button => button.addEventListener("click", () => openAuth(button.dataset.role)));
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => closeModal(button.dataset.close)));
document.querySelectorAll(".auth-tab").forEach(button => button.addEventListener("click", () => setAuthMode(button.dataset.mode)));

$("#authForm").addEventListener("submit", event => { event.preventDefault(); enterPortal(); });
$("#availabilityForm").addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;
  // EXCEPTION HANDLING: invalid doctor hours are shown below the form instead of stopping the app.
  try {
    scheduler.publish(form.availabilityDate.value, form.startTime.value, form.endTime.value);
    $("#availabilityMessage").textContent = "Availability is now live for pet parents.";
    renderDoctor();
  } catch (error) { $("#availabilityMessage").textContent = error.message; }
});

$("#petForm").addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;
  const types = [...form.querySelectorAll('input[name="appointmentType"]:checked')].map(input => input.value);
  if (!types.length) { $("#petMessage").textContent = "Please choose at least one appointment type."; return; }
  const data = Object.fromEntries(new FormData(form));
  const petType = data.petType === "Others" ? data.otherPetType.trim() : data.petType;
  customerDetails = { ownerName: data.ownerName, petName: data.petName, petType, address: data.address, contact: data.contact, types };
  selectedDate = null;
  selectedTime = null;
  $("#submitBooking").disabled = true;
  $("#selectedSlotMessage").textContent = "Select a time to continue.";
  openModal("scheduleModal");
  renderScheduleModal();
});

$("#submitBooking").addEventListener("click", submitBooking);
$("#petType").addEventListener("change", event => {
  const isOther = event.target.value === "Others";
  $("#otherPetField").classList.toggle("hidden", !isOther);
  $("#otherPetType").required = isOther;
  if (!isOther) $("#otherPetType").value = "";
});
$("#copyReference").addEventListener("click", async () => {
  const code = $("#referenceCode").textContent;
  try {
    await navigator.clipboard.writeText(code);
    $("#copyReference").textContent = "Copied!";
    setTimeout(() => { $("#copyReference").textContent = "Copy"; }, 1800);
  } catch (error) {
    showToast("Unable to copy automatically. Please copy the reference code manually.");
  }
});
$("#confirmationDone").addEventListener("click", () => $("#homeBtn").click());
$("#referenceLookupForm").addEventListener("submit", event => {
  event.preventDefault();
  renderLookup(scheduler.findByReference($("#referenceInput").value));
});
$("#homeBtn").addEventListener("click", () => {
  closeModal("authModal"); closeModal("scheduleModal"); closeModal("confirmationModal");
  $("#app").classList.add("hidden"); $("#landing").classList.remove("hidden"); $("#signOut").classList.add("hidden"); $("#backHome").classList.add("hidden");
  $("#viewTitle").innerHTML = '<span class="pulse"></span>Veterinary care, made simple';
  customerDetails = null; selectedTime = null; role = null;
});
$("#signOut").addEventListener("click", () => $("#homeBtn").click());
$("#backHome").addEventListener("click", () => $("#homeBtn").click());

document.addEventListener("DOMContentLoaded", () => { $("#availabilityDate").value = localDateString(); });
