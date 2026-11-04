
// NOTE: This started as a provided file. We edited it so a range can be up to a month long.

// NASA's APOD archive only has images from June 16, 1995 onwards
const earliestDate = '1995-06-16';

// The longest range we allow, counting both the first and last day
const MAX_DAYS = 31;

// Turn a Date into text like "2026-11-03" using your local date
function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get today's date in YYYY-MM-DD format (required by date inputs)
const today = toDateString(new Date());

// Add days to a date like "2026-11-03". Use a negative number to go back.
function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

// Count the days from the start date to the end date, counting both. The same day twice is 1.
function countDays(startDate, endDate) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const difference = new Date(`${endDate}T00:00:00`) - new Date(`${startDate}T00:00:00`);
  return Math.round(difference / millisecondsPerDay) + 1;
}

function setupDateInputs(startInput, endInput) {
  // Restrict date selection range from NASA's first image to today
  startInput.min = earliestDate;
  startInput.max = today;
  endInput.min = earliestDate;
  endInput.max = today;

  // Default: Show the last week, which is 7 days counting today
  startInput.value = addDays(today, -6);
  endInput.value = today;

  // When the start date changes, keep the end date if the range is still good.
  // If the end date is now before the start date, or the range is longer than a month,
  // move the end date to a week after the start date, but never past today.
  startInput.addEventListener('change', () => {
    if (!startInput.value) {
      return;
    }

    const days = endInput.value ? countDays(startInput.value, endInput.value) : 0;
    if (days < 1 || days > MAX_DAYS) {
      const weekLater = addDays(startInput.value, 6);
      endInput.value = weekLater > today ? today : weekLater;
    }
  });
}
