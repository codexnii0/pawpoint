# Pawpoint Veterinary Appointment Scheduling System

Pawpoint is a responsive front-end appointment scheduling website for a veterinary clinic. It provides separate pet-parent and veterinarian portals, appointment availability, automatic doctor rest periods, booking reference codes, and visit summaries.

## Features

- Role-specific sign-in/register interface for pet parents and veterinarians
- Doctor availability management by date and time
- Default clinic hours: **8:00 AM to 6:00 PM**
- Required pet-parent intake form:
  - Owner name
  - Pet name
  - Pet type (Dog, Cat, Bird, or a required custom type)
  - Appointment type
  - Address and contact number
- Appointment-time modal shown only after the intake form is complete
- One-hour appointments with an automatically reserved one-hour doctor rest period afterward
- Pet parents only see open appointment times; booked and rest periods remain private
- Generated appointment reference code with a copy button
- Generated visit summary report
- Doctor reference-code lookup displaying the complete intake and summary report
- Responsive layout for mobile, tablet, laptop, and desktop screens

## Run Locally

This is a static website. No installation or build step is required.

1. Open the project folder in VS Code.
2. Install the **Live Server** extension.
3. Right-click `index.html` and choose **Open with Live Server**.

You can also open `index.html` directly in a browser. Live Server is recommended because the project uses a Web Worker.

## Project Files

```text
Dental_Sched/
├── index.html   # Page structure, forms, and modals
├── styles.css   # Responsive visual design
├── app.js       # Scheduling behavior and application logic
└── README.md    # Project documentation
```

## Programming Concepts Used

The relevant sections in `app.js` are labelled with comments.

| Requirement | Implementation |
| --- | --- |
| Encapsulation | `Scheduler` uses private `#availability` and `#bookings` fields. |
| OOP | The `Scheduler` class owns availability, slot, booking, and lookup behavior. |
| Higher-order functions | `map()`, `find()`, `filter()`, `forEach()`, and `Promise.all()` process schedules and user-interface elements. |
| Lambda expressions | Arrow functions are used as callbacks, for example with `map()` and event listeners. |
| Exception handling | `try`/`catch` handles invalid availability and booking conflicts without stopping the application. |
| Threads / concurrency | A browser `Web Worker` formats time labels in the background; Promises return those results to the interface. |

## Deploy

### Vercel

1. Push this folder to a GitHub repository.
2. Sign in to [Vercel](https://vercel.com/) with GitHub.
3. Select **Add New → Project** and import the repository.
4. Select **Other** as the framework preset. Leave the build command and output directory empty.
5. Click **Deploy**.

### Netlify

Visit [Netlify Drop](https://app.netlify.com/drop) and drag the project folder onto the deployment page.

## Important Limitation

This version is a front-end demonstration. Appointment data exists only in the active browser session and is cleared when the page is refreshed. To use it as a real clinic system where bookings are shared and stored for all devices, connect the application to a backend and database such as Firebase or Supabase.
