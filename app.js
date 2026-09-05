const state = {
  tracks: [],
  filteredTracks: [],
  activeIndex: 0,
};

const trackList = document.querySelector("#trackList");
const searchInput = document.querySelector("#search");
const trackTitle = document.querySelector("#trackTitle");
const trackPosition = document.querySelector("#trackPosition");
const audioPlayer = document.querySelector("#audioPlayer");
const transcript = document.querySelector("#transcript");
const transcriptCount = document.querySelector("#transcriptCount");
const previousButton = document.querySelector("#previousTrack");
const nextButton = document.querySelector("#nextTrack");
const shell = document.querySelector(".shell");
const library = document.querySelector(".library");
const paneResizer = document.querySelector(".pane-resizer");
const openLibraryButton = document.querySelector("#openLibrary");
const closeLibraryButton = document.querySelector("#closeLibrary");
const libraryBackdrop = document.querySelector("#libraryBackdrop");

function setLibraryOpen(isOpen) {
  document.body.classList.toggle("is-library-open", isOpen);
  libraryBackdrop.hidden = !isOpen;
  openLibraryButton.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) {
    closeLibraryButton.focus();
  } else {
    openLibraryButton.focus();
  }
}

function setLibraryHeight(clientY) {
  const shellBounds = shell.getBoundingClientRect();
  const minimum = 160;
  const maximum = shellBounds.height - 260;
  const height = Math.max(minimum, Math.min(clientY - shellBounds.top, maximum));
  shell.style.setProperty("--library-height", `${height}px`);
}

function initializePaneResizer() {
  if (!paneResizer) {
    return;
  }

  let isDragging = false;

  paneResizer.addEventListener("pointerdown", (event) => {
    isDragging = true;
    paneResizer.setPointerCapture(event.pointerId);
    document.body.classList.add("is-resizing");
  });

  paneResizer.addEventListener("pointermove", (event) => {
    if (isDragging) {
      setLibraryHeight(event.clientY);
    }
  });

  const stopDragging = (event) => {
    isDragging = false;
    if (paneResizer.hasPointerCapture(event.pointerId)) {
      paneResizer.releasePointerCapture(event.pointerId);
    }
    document.body.classList.remove("is-resizing");
  };

  paneResizer.addEventListener("pointerup", stopDragging);
  paneResizer.addEventListener("pointercancel", stopDragging);
  paneResizer.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const current = shell.getBoundingClientRect().top + library.getBoundingClientRect().height;
      setLibraryHeight(current + (event.key === "ArrowDown" ? 32 : -32));
    }
  });
}

function renderTrackList() {
  trackList.innerHTML = "";

  if (!state.filteredTracks.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No tracks found.";
    trackList.append(empty);
    return;
  }

  let currentChapter = null;
  let chapterList = null;
  state.filteredTracks.forEach((track, index) => {
    if (track.chapter !== currentChapter) {
      currentChapter = track.chapter;
      const group = document.createElement("section");
      group.className = "chapter-group";

      if (track.chapterTitle) {
        const heading = document.createElement("h2");
        heading.className = "chapter-title";
        heading.textContent = `${track.chapterTitle} ${track.chapterTitleZh}`;
        group.append(heading);
      }

      chapterList = document.createElement("ol");
      chapterList.className = "chapter-lessons";
      group.append(chapterList);
      trackList.append(group);
    }

    const item = document.createElement("li");
    const button = document.createElement("button");
    button.className = "track-button";
    button.type = "button";
    button.textContent = track.lessonTitle || track.title;
    button.classList.toggle("is-active", index === state.activeIndex);
    button.addEventListener("click", () => {
      selectTrack(index);
      setLibraryOpen(false);
    });
    item.append(button);
    chapterList.append(item);
  });
}

function renderTranscript(content) {
  transcript.innerHTML = "";
  let totalItems = 0;

  content.sections.forEach((section) => {
    const sectionElement = document.createElement("section");
    sectionElement.className = `transcript-section transcript-section-${section.type}`;

    const heading = document.createElement("h4");
    heading.textContent = section.title;
    sectionElement.append(heading);

    const list = document.createElement(section.type === "sentences" ? "ol" : "ul");
    list.className = "transcript-items";
    section.items.forEach((item) => {
      const listItem = document.createElement("li");
      listItem.textContent = item;
      list.append(listItem);
    });
    totalItems += section.items.length;
    sectionElement.append(list);
    transcript.append(sectionElement);
  });

  transcriptCount.textContent = `${totalItems} items`;
}

async function loadTranscript(track) {
  transcript.innerHTML = '<p class="transcript-status">Loading transcript...</p>';
  transcriptCount.textContent = "";
  const response = await fetch(track.content || track.text);
  if (!response.ok) {
    throw new Error(`Could not load ${track.content || track.text}`);
  }
  const content = track.content
    ? await response.json()
    : { sections: [{ type: "text", title: "Transcript", items: [await response.text()] }] };
  renderTranscript(content);
}

async function selectTrack(index) {
  if (!state.filteredTracks.length) {
    return;
  }

  state.activeIndex = Math.max(0, Math.min(index, state.filteredTracks.length - 1));
  const track = state.filteredTracks[state.activeIndex];
  trackTitle.textContent = track.lessonTitle || track.title;
  trackPosition.textContent = `Lesson ${state.activeIndex + 1} of ${state.filteredTracks.length}`;
  audioPlayer.src = track.audio;
  previousButton.disabled = state.activeIndex === 0;
  nextButton.disabled = state.activeIndex === state.filteredTracks.length - 1;
  renderTrackList();

  try {
    await loadTranscript(track);
  } catch (error) {
    transcript.innerHTML = "";
    const status = document.createElement("p");
    status.className = "transcript-status";
    status.textContent = error.message;
    transcript.append(status);
    transcriptCount.textContent = "";
  }
}

function applySearch() {
  const query = searchInput.value.trim().toLowerCase();
  state.filteredTracks = state.tracks.filter((track) => {
    const searchableText = [
      track.title,
      track.chapterTitle,
      track.chapterTitleZh,
      track.lessonTitle,
    ].filter(Boolean).join(" ").toLowerCase();
    return searchableText.includes(query);
  });
  selectTrack(0);
}

async function initialize() {
  try {
    const response = await fetch("manifest.json?v=20260901", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("manifest.json was not found. Run generate_static_site.py first.");
    }

    state.tracks = await response.json();
    state.filteredTracks = state.tracks;

    if (!state.tracks.length) {
      trackTitle.textContent = "No lessons published";
      trackPosition.textContent = "";
      transcript.innerHTML = "";
      const status = document.createElement("p");
      status.className = "transcript-status";
      status.textContent = "Run generate_static_site.py after the TXT files are ready.";
      transcript.append(status);
      renderTrackList();
      return;
    }

    renderTrackList();
    await selectTrack(0);
  } catch (error) {
    trackTitle.textContent = "Site data unavailable";
    transcript.innerHTML = "";
    const status = document.createElement("p");
    status.className = "transcript-status";
    status.textContent = error.message;
    transcript.append(status);
  }
}

searchInput.addEventListener("input", applySearch);
previousButton.addEventListener("click", () => selectTrack(state.activeIndex - 1));
nextButton.addEventListener("click", () => selectTrack(state.activeIndex + 1));
openLibraryButton.addEventListener("click", () => setLibraryOpen(true));
closeLibraryButton.addEventListener("click", () => setLibraryOpen(false));
libraryBackdrop.addEventListener("click", () => setLibraryOpen(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("is-library-open")) {
    setLibraryOpen(false);
  }
});
initializePaneResizer();

initialize();