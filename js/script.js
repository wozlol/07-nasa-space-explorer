// Find our date picker inputs on the page
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');

// Call the setupDateInputs function from dateRange.js
// This sets up the date pickers to:
// - Default to a range of 9 days (from 9 days ago to today)
// - Restrict dates to NASA's image archive (starting from 1995)
setupDateInputs(startInput, endInput);

// ----- Page elements we need to change -----
const getImagesButton = document.getElementById('getImagesBtn');
const gallery = document.getElementById('gallery');
const spaceFactText = document.getElementById('spaceFactText');
const modal = document.getElementById('modal');
const modalClose = document.getElementById('modalClose');
const modalMedia = document.getElementById('modalMedia');
const modalTitle = document.getElementById('modalTitle');
const modalDate = document.getElementById('modalDate');
const modalExplanation = document.getElementById('modalExplanation');
const modalCredit = document.getElementById('modalCredit');

// ----- NASA API settings -----
// NASA moved the Astronomy Picture of the Day to science.nasa.gov.
// The old api.nasa.gov address now sends the NASA logo for every date.
// This new address needs no API key. Adding /YYMMDD to the end (like /261028) gives one day.
const APOD_URL = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic';

// Asks NASA to send only the pieces we use, which keeps each answer small
const APOD_FIELDS = 'date,title,media_type,hdurl,permalink,explanation,copyright,credit';

// NASA gives one day per request, so a long range means many requests
const MAX_DAYS = 31;

// ----- LevelUp: Random Space Fact -----
// A list of facts. One is picked at random each time the page loads.
const spaceFacts = [
  'A day on Venus is longer than its year. Venus spins once every 243 Earth days, but orbits the Sun in about 225.',
  'A teaspoon of neutron star material would weigh billions of tons on Earth.',
  'Sunlight takes about 8 minutes and 20 seconds to travel to Earth.',
  'Saturn is so light for its size that it would float in a bathtub big enough to hold it.',
  'Olympus Mons on Mars is the tallest known volcano in our solar system, about two and a half times as tall as Mount Everest.',
  'The Sun holds about 99.8 percent of all the mass in our solar system.',
  'Astronauts can grow up to 2 inches taller in space because their spines stretch without gravity.',
  'Apollo astronaut footprints on the Moon could last for millions of years because there is no wind or water to wipe them away.',
  'Voyager 1 launched in 1977 and is the most distant human-made object from Earth.',
  'A year on Mercury is only 88 Earth days long.',
  'Jupiter\'s Great Red Spot is a storm wider than Earth that has been seen for more than 150 years.'
];

function showRandomFact() {
  // Math.random() gives a number from 0 up to (but not including) 1.
  // Multiplying by the list length and rounding down gives a valid list position.
  const randomIndex = Math.floor(Math.random() * spaceFacts.length);
  spaceFactText.textContent = spaceFacts[randomIndex];
}

// ----- Small helper functions -----

// Turn "2026-11-03" into "November 3, 2026"
// Adding T00:00:00 makes the browser read it as your local date, so it never shows the day before
function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Makes text safe to put inside HTML, so odd characters in NASA's data can't break the page
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// NASA sends some text with HTML inside it, like links. This turns it into plain text.
function htmlToText(html) {
  const withSpaces = String(html).replace(/<br\s*\/?>/gi, ' ');
  const doc = new DOMParser().parseFromString(withSpaces, 'text/html');
  return doc.body.textContent.replace(/\s+/g, ' ').trim();
}

// Replace everything in the gallery with one centered message
function showMessage(icon, text) {
  gallery.innerHTML = `
    <div class="placeholder">
      <div class="placeholder-icon">${icon}</div>
      <p>${text}</p>
    </div>
  `;
}

// Make a list of day codes for every day from the start date to the end date.
// NASA wants each day as YYMMDD, so 2026-10-28 becomes 261028.
function getDayCodes(startDate, endDate) {
  const codes = [];
  const day = new Date(`${startDate}T00:00:00`);
  const lastDay = new Date(`${endDate}T00:00:00`);

  while (day <= lastDay) {
    const year = String(day.getFullYear()).slice(-2);
    const month = String(day.getMonth() + 1).padStart(2, '0');
    const date = String(day.getDate()).padStart(2, '0');
    codes.push(`${year}${month}${date}`);
    day.setDate(day.getDate() + 1); // move to the next day
  }
  return codes;
}

// The "Explanation:" label and the "Tomorrow's picture" teaser are not part of the explanation
function cleanExplanation(html) {
  return htmlToText(html)
    .replace(/^Explanation:\s*/i, '')
    .replace(/\s*Tomorrow.s picture:.*$/i, '');
}

// Turn one entry from NASA into a simple object with only what our page needs
function cleanEntry(raw) {
  return {
    date: raw.date,
    title: htmlToText(raw.title),
    isVideo: raw.media_type !== 'image',
    imageUrl: raw.hdurl, // for a video, this is a still picture from it
    pageUrl: raw.permalink, // NASA's page for this entry, which plays the video
    explanation: cleanExplanation(raw.explanation),
    credit: htmlToText(raw.copyright || raw.credit || '')
  };
}

// ----- Fetch data from NASA -----

// Get one day. Gives back null when NASA has no entry for that day.
async function getOneDay(dayCode) {
  const response = await fetch(`${APOD_URL}/${dayCode}?_fields=${APOD_FIELDS}`);

  if (response.status === 404) {
    return null;
  }
  // NASA sometimes answers with an error page instead of data
  if (!response.ok) {
    throw new Error(`NASA answered with status ${response.status}`);
  }

  const data = await response.json();
  return cleanEntry(data);
}

async function getSpaceImages() {
  const startDate = startInput.value;
  const endDate = endInput.value;

  // Make sure both dates are filled in and in the right order
  if (!startDate || !endDate || startDate > endDate) {
    showMessage('📅', 'Please pick a start date that is on or before the end date.');
    return;
  }

  const dayCodes = getDayCodes(startDate, endDate);
  if (dayCodes.length > MAX_DAYS) {
    showMessage('📅', `Please pick ${MAX_DAYS} days or fewer.`);
    return;
  }

  // Show the loading message and stop extra clicks while we wait
  showMessage('🔄', '<em>Loading space photos…</em>');
  getImagesButton.disabled = true;

  try {
    // Ask for every day at the same time. allSettled waits for all of them,
    // and one failed day does not throw away the days that worked.
    const results = await Promise.allSettled(dayCodes.map(getOneDay));

    // Keep the days that worked and had an entry
    const items = results
      .filter((result) => result.status === 'fulfilled' && result.value)
      .map((result) => result.value);
    const failedCount = results.filter((result) => result.status === 'rejected').length;

    if (items.length === 0 && failedCount > 0) {
      throw new Error('Every request failed');
    }

    displayGallery(items, failedCount);
  } catch (error) {
    console.error('Could not get space images:', error);
    showMessage('⚠️', 'Sorry, we could not get the space photos from NASA. Please wait a moment and try again.');
  } finally {
    // Turn the button back on whether it worked or not
    getImagesButton.disabled = false;
  }
}

// ----- Show the gallery -----
function displayGallery(items, failedCount) {
  if (items.length === 0) {
    showMessage('🔭', 'NASA has no photos for those dates.');
    return;
  }

  // Remove the loading message
  gallery.innerHTML = '';

  // Tell the user if a few days did not load
  if (failedCount > 0) {
    const note = document.createElement('p');
    note.className = 'gallery-note';
    note.textContent = `${failedCount} day(s) could not be loaded. Click "Get Space Images" to try again.`;
    gallery.appendChild(note);
  }

  items.forEach((item) => {
    // Use a box with a play symbol if a video has no picture
    const picture = item.imageUrl
      ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" loading="lazy" />`
      : '<div class="video-placeholder">▶</div>';

    const card = document.createElement('div');
    card.className = 'gallery-item';
    card.tabIndex = 0; // lets keyboard users reach the card with the Tab key
    card.setAttribute('role', 'button');
    card.innerHTML = `
      <div class="thumb">
        ${picture}
        ${item.isVideo ? '<span class="video-badge">▶ Video</span>' : ''}
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${formatDate(item.date)}</p>
    `;

    // Open the modal on a click, or on Enter or Space for keyboard users
    card.addEventListener('click', () => openModal(item));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openModal(item);
      }
    });

    gallery.appendChild(card);
  });
}

// ----- Modal window -----
let lastFocusedElement = null;

// What goes at the top of the modal: the big picture, and for a video also a link to watch it
function buildModalMedia(item) {
  const picture = item.imageUrl
    ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" />`
    : '';

  if (!item.isVideo) {
    return picture;
  }

  // NASA does not give us a video we can play inside our page, so link to the entry on NASA's site
  return `${picture}<a class="video-link" href="${escapeHtml(item.pageUrl)}" target="_blank" rel="noopener">▶ Watch this video on NASA's site</a>`;
}

function openModal(item) {
  lastFocusedElement = document.activeElement; // remember where we were

  modalMedia.innerHTML = buildModalMedia(item);
  modalTitle.textContent = item.title;
  modalDate.textContent = formatDate(item.date);
  modalExplanation.textContent = item.explanation;

  // Some entries have a photographer credit
  modalCredit.textContent = item.credit ? `Credit: ${item.credit}` : '';

  modal.hidden = false;
  document.body.classList.add('modal-open'); // stops the page behind from scrolling
  modalClose.focus();
}

function closeModal() {
  modal.hidden = true;
  modalMedia.innerHTML = ''; // clear the picture so the next one never flashes the old one
  document.body.classList.remove('modal-open');
  if (lastFocusedElement) {
    lastFocusedElement.focus(); // go back to the card that was clicked
  }
}

// ----- Connect the buttons and keys -----
getImagesButton.addEventListener('click', getSpaceImages);
modalClose.addEventListener('click', closeModal);

// Clicking the dark area outside the white box closes the modal
modal.addEventListener('click', (event) => {
  if (event.target === modal) {
    closeModal();
  }
});

// The Escape key closes the modal
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modal.hidden) {
    closeModal();
  }
});

// Pick a random fact as soon as the page loads
showRandomFact();
