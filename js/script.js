// Find our date picker inputs on the page
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');

// Call the setupDateInputs function from dateRange.js
// This sets up the date pickers to:
// - Default to the last 7 days
// - Allow a range of up to a month
// - Restrict dates to NASA's image archive (starting from 1995)
setupDateInputs(startInput, endInput);

// ----- Page elements we need to change -----
const getImagesButton = document.getElementById('getImagesBtn');
const gallery = document.getElementById('gallery');
const spaceFactText = document.getElementById('spaceFactText');
const moreFactButton = document.getElementById('moreFactBtn');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');
const modalClose = document.getElementById('modalClose');
const modalPrev = document.getElementById('modalPrev');
const modalNext = document.getElementById('modalNext');
const modalMedia = document.getElementById('modalMedia');
const modalTitle = document.getElementById('modalTitle');
const modalDate = document.getElementById('modalDate');
const modalExplanation = document.getElementById('modalExplanation');
const modalCredit = document.getElementById('modalCredit');
const modalShare = document.getElementById('modalShare');
const loadingModal = document.getElementById('loadingModal');

// ----- NASA API settings -----
// NASA moved the Astronomy Picture of the Day to science.nasa.gov.
// The old api.nasa.gov address now sends the NASA logo for every date.
// This new address needs no API key. Adding /YYMMDD to the end (like /261028) gives one day.
const APOD_URL = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic';

// Asks NASA to send only the pieces we use, which keeps each answer small
const APOD_FIELDS = 'date,title,media_type,hdurl,permalink,explanation,copyright,credit';

const SHARE_LABEL = 'Share…';

// ----- What the page remembers -----
let currentItems = []; // the entries in the gallery right now
let currentStart = ''; // the first day of the group on screen
let currentEnd = ''; // the last day of the group on screen
let groupSize = 7; // how many days the user asked for. Previous and Next move by this many.
let openIndex = -1; // which entry the modal shows, or -1 when the modal is closed
let isLoading = false; // true while we wait for NASA

// ----- LevelUp: Random Space Fact -----
// A list of facts. One is picked at random when the page loads and again on "tell me more".
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

let currentFactIndex = -1;

function showRandomFact() {
  // Math.random() gives a number from 0 up to (but not including) 1.
  // Multiplying by the list length and rounding down gives a valid list position.
  // We pick again if we got the fact that is already showing, so "tell me more" always changes it.
  let randomIndex = currentFactIndex;
  while (randomIndex === currentFactIndex) {
    randomIndex = Math.floor(Math.random() * spaceFacts.length);
  }

  currentFactIndex = randomIndex;
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

// "1 day" or "7 days"
function daysLabel(count) {
  return `${count} day${count === 1 ? '' : 's'}`;
}

// Replace everything in the gallery with one centered message
function showMessage(icon, text, withPager = false) {
  gallery.innerHTML = `
    <div class="placeholder">
      <div class="placeholder-icon">${icon}</div>
      <p>${text}</p>
    </div>
  `;

  // Keep the Previous and Next buttons so the user is never stuck on an empty group
  if (withPager) {
    gallery.appendChild(createPager());
  }
}

// ----- The page address -----
// The address holds the dates and the open entry, like ?start=2026-10-26&end=2026-11-03&date=2026-10-28
// That way a copied link brings someone back to the same group and the same entry.

// True for a real day in NASA's archive, written like 2026-10-28
function isValidDay(text) {
  return /^\d{4}-\d{2}-\d{2}$/.test(text)
    && text >= earliestDate
    && text <= today
    && toDateString(new Date(`${text}T00:00:00`)) === text; // catches days like 2026-02-31
}

// Update the address bar without reloading. Pass the date of the open entry, or null for none.
function updateUrl(openDate) {
  try {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    if (currentStart) {
      url.searchParams.set('start', currentStart);
      url.searchParams.set('end', currentEnd);
    }
    if (openDate) {
      url.searchParams.set('date', openDate);
    }
    history.replaceState(null, '', url);
  } catch (error) {
    // Some browsers do not allow this for a page opened as a file from your computer
  }
}

// The link we send to a friend for one entry
function getShareUrl(item) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('start', currentStart);
  url.searchParams.set('end', currentEnd);
  url.searchParams.set('date', item.date);
  return url.toString();
}

// ----- Turning NASA's data into simple entries -----

// Make a list of day codes for every day from the start date to the end date.
// NASA wants each day as YYMMDD, so 2026-10-28 becomes 261028.
function getDayCodes(startDate, endDate) {
  const codes = [];
  for (let day = startDate; day <= endDate; day = addDays(day, 1)) {
    codes.push(day.slice(2).replace(/-/g, ''));
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

// Load and show one group of days. Gives back the entries, or an empty list if nothing loaded.
// Pass false for showInAddress to leave the dates out of the page address.
async function loadRange(startDate, endDate, showInAddress = true) {
  isLoading = true;
  getImagesButton.disabled = true; // stops extra clicks while we wait

  currentItems = [];
  currentStart = startDate;
  currentEnd = endDate;
  startInput.value = startDate;
  endInput.value = endDate;
  if (showInAddress) {
    updateUrl(null);
  }
  gallery.innerHTML = ''; // clear the old cards so nothing can be clicked while we wait
  loadingModal.hidden = false; // show the spinning planet

  try {
    // Ask for every day at the same time. allSettled waits for all of them,
    // and one failed day does not throw away the days that worked.
    const results = await Promise.allSettled(getDayCodes(startDate, endDate).map(getOneDay));

    // Keep the days that worked and had an entry
    const items = results
      .filter((result) => result.status === 'fulfilled' && result.value)
      .map((result) => result.value);
    const failedCount = results.filter((result) => result.status === 'rejected').length;

    if (items.length === 0 && failedCount > 0) {
      throw new Error('Every request failed');
    }

    currentItems = items;
    displayGallery(items, failedCount);
  } catch (error) {
    console.error('Could not get space images:', error);
    showMessage('⚠️', 'Sorry, we could not get the space photos from NASA. Please wait a moment and try again.');
  } finally {
    // Hide the planet and turn the button back on whether it worked or not
    isLoading = false;
    getImagesButton.disabled = false;
    loadingModal.hidden = true;
  }

  return currentItems;
}

// Runs when the user clicks "Get Space Images"
async function getSpaceImages() {
  if (isLoading) {
    return;
  }

  const startDate = startInput.value;
  const endDate = endInput.value;

  // Make sure both dates are filled in and in the right order
  if (!startDate || !endDate || startDate > endDate) {
    showMessage('📅', 'Please pick a start date that is on or before the end date.');
    return;
  }

  const days = countDays(startDate, endDate);
  if (days > MAX_DAYS) {
    showMessage('📅', `Please pick ${MAX_DAYS} days or fewer.`);
    return;
  }

  // Remember how long this range is. Previous and Next will move by this many days.
  groupSize = days;
  await loadRange(startDate, endDate);
}

// ----- Previous and Next group -----

// Work out the group before or after the one on screen. Gives null when there is nowhere to go.
function getAdjacentRange(direction) {
  if (direction === 'next') {
    if (currentEnd >= today) {
      return null; // we are already at today
    }
    const start = addDays(currentEnd, 1);
    const end = addDays(start, groupSize - 1);
    return { start, end: end > today ? today : end };
  }

  if (currentStart <= earliestDate) {
    return null; // we are already at the first day NASA has
  }
  const end = addDays(currentStart, -1);
  const start = addDays(end, -(groupSize - 1));
  return { start: start < earliestDate ? earliestDate : start, end };
}

function createPagerButton(direction, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `pager-button pager-button-${direction}`;
  button.textContent = label;
  button.addEventListener('click', () => goToGroup(direction));
  return button;
}

// The row of Previous and Next buttons under the gallery
function createPager() {
  const pager = document.createElement('div');
  pager.className = 'pager';

  const previous = getAdjacentRange('previous');
  if (previous) {
    const label = daysLabel(countDays(previous.start, previous.end));
    pager.appendChild(createPagerButton('previous', `← Previous ${label}`));
  }

  const next = getAdjacentRange('next');
  if (next) {
    const label = daysLabel(countDays(next.start, next.end));
    pager.appendChild(createPagerButton('next', `Next ${label} →`));
  }

  return pager;
}

async function goToGroup(direction) {
  const range = getAdjacentRange(direction);
  if (isLoading || !range) {
    return;
  }

  await loadRange(range.start, range.end);

  // Bring the top of the new group into view
  document.querySelector('.filters').scrollIntoView({ block: 'start' });
}

// ----- Show the gallery -----
function displayGallery(items, failedCount) {
  if (items.length === 0) {
    showMessage('🔭', 'NASA has no photos for those dates.', true);
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

  items.forEach((item, index) => {
    // Use a box with a play symbol if a video has no picture
    const picture = item.imageUrl
      ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" loading="lazy" />`
      : '<div class="video-placeholder">▶</div>';

    const card = document.createElement('div');
    card.className = 'gallery-item';
    card.dataset.index = index; // remembers which entry this card is
    card.innerHTML = `
      <div class="card-open" tabindex="0" role="button" aria-label="Open ${escapeHtml(item.title)}">
        <div class="thumb">
          ${picture}
          ${item.isVideo ? '<span class="video-badge">▶ Video</span>' : ''}
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${formatDate(item.date)}</p>
      </div>
    `;

    // Open the modal on a click, or on Enter or Space for keyboard users.
    // tabindex="0" lets keyboard users reach the card with the Tab key.
    // A held key repeats, so repeats are ignored. Otherwise the modal could open again and again.
    const openArea = card.querySelector('.card-open');
    openArea.addEventListener('click', () => showModalAt(index));
    openArea.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!event.repeat) {
          showModalAt(index);
        }
      }
    });

    gallery.appendChild(card);
  });

  // Previous and Next buttons at the bottom
  gallery.appendChild(createPager());
}

// ----- Share an entry with a friend -----
async function shareItem(item, shareButton) {
  const url = getShareUrl(item);
  const text = `${item.title}, NASA's Astronomy Picture of the Day for ${formatDate(item.date)}`;

  // On phones and some computers this opens the normal share menu
  if (navigator.share) {
    try {
      await navigator.share({ title: item.title, text, url });
    } catch (error) {
      // The user closed the share menu, so there is nothing to do
    }
    return;
  }

  // Otherwise copy the link so it can be pasted into a message
  try {
    await navigator.clipboard.writeText(url);
    shareButton.textContent = 'Link copied!';
    setTimeout(() => {
      shareButton.textContent = SHARE_LABEL;
    }, 2000);
  } catch (error) {
    // Last choice: open the email app with the link filled in
    const subject = encodeURIComponent(item.title);
    const body = encodeURIComponent(`${text}\n${url}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }
}

// ----- Modal window -----

// What goes at the top of the modal: the big picture, and for a video also a link to watch it
function buildModalMedia(item) {
  // Clicking the picture opens just the image in a new tab. The title text is the hover tooltip.
  const picture = item.imageUrl
    ? `<a class="image-link" href="${escapeHtml(item.imageUrl)}" target="_blank" rel="noopener" title="Open Image in New Tab"><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" /></a>`
    : '';

  if (!item.isVideo) {
    return picture;
  }

  // NASA does not give us a video we can play inside our page, so link to the entry on NASA's site
  return `${picture}<a class="video-link" href="${escapeHtml(item.pageUrl)}" target="_blank" rel="noopener">▶ Watch this video on NASA's site</a>`;
}

// Can we go to the previous or next entry? Either inside this group, or by loading another group.
function canShowAdjacent(direction) {
  const isInsideGroup = direction === 'next' ? openIndex < currentItems.length - 1 : openIndex > 0;
  return isInsideGroup || getAdjacentRange(direction) !== null;
}

// Show one entry in the modal, opening the modal if it is closed
function showModalAt(index) {
  const item = currentItems[index];
  const wasHidden = modal.hidden;
  openIndex = index;

  modalMedia.innerHTML = buildModalMedia(item);
  modalTitle.textContent = item.title;
  modalDate.textContent = formatDate(item.date);
  modalExplanation.textContent = item.explanation;

  // Some entries have a photographer credit
  modalCredit.textContent = item.credit ? `Credit: ${item.credit}` : '';

  // Show the Share link, back to its normal label if it said "Link copied!"
  modalShare.textContent = SHARE_LABEL;
  modalShare.hidden = false;

  // Hide an arrow when there is nowhere left to go that way
  modalPrev.hidden = !canShowAdjacent('previous');
  modalNext.hidden = !canShowAdjacent('next');

  modal.classList.remove('is-loading');
  modal.hidden = false;
  document.body.classList.add('modal-open'); // stops the page behind from scrolling
  modalContent.scrollTop = 0; // start each entry at the top

  // Keep the keyboard inside the modal. Focus goes on the box itself and not the X button,
  // so Space and the arrow keys scroll the text instead of pressing the X.
  if (wasHidden || document.activeElement.hidden) {
    modalContent.focus({ preventScroll: true });
  }

  updateUrl(item.date);
}

// While the next or previous group loads, hide the white box. The spinning planet shows on top.
function showModalLoading() {
  modal.classList.add('is-loading');
  modalShare.hidden = true;
  modalPrev.hidden = true;
  modalNext.hidden = true;
}

// Go to the next or previous entry. At the end of a group, load the next group
// and keep going, as if the Next button under the gallery was pressed.
async function showAdjacentItem(direction) {
  if (isLoading || openIndex < 0) {
    return;
  }

  const newIndex = openIndex + (direction === 'next' ? 1 : -1);
  if (newIndex >= 0 && newIndex < currentItems.length) {
    showModalAt(newIndex);
    return;
  }

  const range = getAdjacentRange(direction);
  if (!range) {
    return;
  }

  showModalLoading();
  const items = await loadRange(range.start, range.end);

  if (modal.hidden) {
    return; // the user closed the modal while we were loading
  }
  if (items.length === 0) {
    closeModal(); // nothing to show, so the gallery behind shows why
    return;
  }

  // Going forward starts at the first entry. Going back starts at the last one.
  showModalAt(direction === 'next' ? 0 : items.length - 1);
}

function closeModal() {
  if (modal.hidden) {
    return;
  }

  // Find the card for the entry we were looking at, so focus can go back to it
  const card = gallery.querySelector(`.gallery-item[data-index="${openIndex}"] .card-open`);

  modal.classList.remove('is-loading');
  modal.hidden = true;
  openIndex = -1;
  modalMedia.innerHTML = ''; // clear the picture so the next one never flashes the old one
  document.body.classList.remove('modal-open');
  updateUrl(null);

  if (card) {
    card.focus();
  }
}

// ----- Connect the buttons and keys -----
getImagesButton.addEventListener('click', getSpaceImages);
moreFactButton.addEventListener('click', showRandomFact);
modalClose.addEventListener('click', closeModal);
modalPrev.addEventListener('click', (event) => {
  focusBoxAfterMouseClick(event);
  showAdjacentItem('previous');
});
modalNext.addEventListener('click', (event) => {
  focusBoxAfterMouseClick(event);
  showAdjacentItem('next');
});

// Share the entry that is open in the modal
modalShare.addEventListener('click', (event) => {
  focusBoxAfterMouseClick(event);
  if (openIndex >= 0) {
    shareItem(currentItems[openIndex], modalShare);
  }
});

// After a mouse click on an arrow or Share, put the focus back on the box. Otherwise pressing Space
// to scroll the text would press the arrow again. A click from the keyboard keeps its focus.
function focusBoxAfterMouseClick(event) {
  if (event.detail > 0) {
    modalContent.focus({ preventScroll: true });
  }
}

// Clicking the dark area outside the white box closes the modal.
// The press must also have started on the dark area. That way dragging the scroll bar
// or selecting text and letting go outside the box does not close it by accident.
let pressStartedOnBackdrop = false;

modal.addEventListener('mousedown', (event) => {
  pressStartedOnBackdrop = event.target === modal;
});

modal.addEventListener('click', (event) => {
  if (event.target === modal && pressStartedOnBackdrop) {
    closeModal();
  }
});

// Keys for the modal: Escape closes it and the left and right arrows move between entries
document.addEventListener('keydown', (event) => {
  if (modal.hidden) {
    return;
  }

  if (event.key === 'Escape') {
    closeModal();
  } else if (event.key === 'ArrowRight') {
    showAdjacentItem('next');
  } else if (event.key === 'ArrowLeft') {
    showAdjacentItem('previous');
  }
});

// Swipe on a touch screen: swipe left for the next entry and right for the previous one
let touchStartX = 0;
let touchStartY = 0;
let touchStartScroll = 0;
let isSingleTouch = true;

modal.addEventListener('touchstart', (event) => {
  touchStartX = event.changedTouches[0].clientX;
  touchStartY = event.changedTouches[0].clientY;
  touchStartScroll = modalContent.scrollTop;
  isSingleTouch = event.touches.length === 1; // two fingers is a pinch and not a swipe
  pressStartedOnBackdrop = event.target === modal;
}, { passive: true });

modal.addEventListener('touchend', (event) => {
  const moveX = event.changedTouches[0].clientX - touchStartX;
  const moveY = event.changedTouches[0].clientY - touchStartY;
  const wasScrolling = Math.abs(modalContent.scrollTop - touchStartScroll) > 5;

  // Only count a swipe that is long, mostly sideways and not a scroll,
  // so reading the text and scrolling up and down never changes the entry
  if (isSingleTouch && !wasScrolling && Math.abs(moveX) > 60 && Math.abs(moveX) > Math.abs(moveY) * 2) {
    showAdjacentItem(moveX < 0 ? 'next' : 'previous');
  }
}, { passive: true });

// ----- Glossy shine on the header -----
// The shine sits still on the upper left. When the mouse moves over the header it drifts
// a little toward the mouse, easing along slowly, and it settles back when the mouse leaves.
const siteHeader = document.querySelector('.site-header');
const SHEEN_REST = { x: 12, y: 0 }; // where the shine sits, in percent of the header
const SHEEN_PULL = 0.35; // how much of the way from rest to the mouse the shine travels
const SHEEN_EASE = 0.08; // how fast it catches up, smaller is lazier
let sheenNow = { x: SHEEN_REST.x, y: SHEEN_REST.y };
let sheenGoal = { x: SHEEN_REST.x, y: SHEEN_REST.y };
let sheenFrame = null;

// Move the shine a small step toward its goal, and keep going until it arrives
function moveSheen() {
  sheenNow.x += (sheenGoal.x - sheenNow.x) * SHEEN_EASE;
  sheenNow.y += (sheenGoal.y - sheenNow.y) * SHEEN_EASE;
  siteHeader.style.setProperty('--sheen-x', `${sheenNow.x.toFixed(2)}%`);
  siteHeader.style.setProperty('--sheen-y', `${sheenNow.y.toFixed(2)}%`);

  const isThere = Math.abs(sheenGoal.x - sheenNow.x) < 0.05 && Math.abs(sheenGoal.y - sheenNow.y) < 0.05;
  sheenFrame = isThere ? null : requestAnimationFrame(moveSheen);
}

function aimSheen(x, y) {
  sheenGoal = { x, y };
  if (sheenFrame === null) {
    sheenFrame = requestAnimationFrame(moveSheen);
  }
}

// Skip all of this for people who ask their device for less motion
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  siteHeader.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') {
      return; // a finger has no hover, so the shine stays put
    }

    const box = siteHeader.getBoundingClientRect();
    const mouseX = ((event.clientX - box.left) / box.width) * 100;
    const mouseY = ((event.clientY - box.top) / box.height) * 100;
    aimSheen(
      SHEEN_REST.x + (mouseX - SHEEN_REST.x) * SHEEN_PULL,
      SHEEN_REST.y + (mouseY - SHEEN_REST.y) * SHEEN_PULL
    );
  });

  siteHeader.addEventListener('pointerleave', () => {
    aimSheen(SHEEN_REST.x, SHEEN_REST.y);
  });
}

// ----- Start up -----

// Load a group as soon as the page opens.
// If the page address has dates in it (a shared link), load that group and open that entry.
// Otherwise load the most recent week, which is what the date pickers already show.
async function loadStartingGroup() {
  const params = new URLSearchParams(window.location.search);
  const startDate = params.get('start');
  const endDate = params.get('end');
  const openDate = params.get('date');

  const isGoodRange = isValidDay(startDate) && isValidDay(endDate)
    && startDate <= endDate
    && countDays(startDate, endDate) <= MAX_DAYS;
  if (!isGoodRange) {
    // The address stays clean, so a bookmark or a refresh always shows the newest week
    groupSize = countDays(startInput.value, endInput.value);
    await loadRange(startInput.value, endInput.value, false);
    return;
  }

  groupSize = countDays(startDate, endDate);
  const items = await loadRange(startDate, endDate);

  const index = items.findIndex((item) => item.date === openDate);
  if (openDate && index !== -1) {
    showModalAt(index);
  }
}

// Pick a random fact as soon as the page loads
showRandomFact();
loadStartingGroup();
