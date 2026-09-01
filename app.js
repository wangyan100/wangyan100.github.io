const state = {
  tracks: [],
  filteredTracks: [],
  activeIndex: 0,
};

const trackList = document.querySelector("#trackList");
const searchInput = document.querySelector("#search");
const trackTitle = document.querySelector("#trackTitle");
const audioPlayer = document.querySelector("#audioPlayer");
const transcript = document.querySelector("#transcript");
const previousButton = document.querySelector("#previousTrack");
const nextButton = document.querySelector("#nextTrack");

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
    button.addEventListener("click", () => selectTrack(index));
    item.append(button);
    chapterList.append(item);
  });
}

async function loadTranscript(track) {
  transcript.textContent = "Loading transcript...";
  const response = await fetch(track.text);
  if (!response.ok) {
    throw new Error(`Could not load ${track.text}`);
  }
  transcript.textContent = await response.text();
}

async function selectTrack(index) {
  if (!state.filteredTracks.length) {
    return;
  }

  state.activeIndex = Math.max(0, Math.min(index, state.filteredTracks.length - 1));
  const track = state.filteredTracks[state.activeIndex];
  trackTitle.textContent = track.lessonTitle || track.title;
  audioPlayer.src = track.audio;
  previousButton.disabled = state.activeIndex === 0;
  nextButton.disabled = state.activeIndex === state.filteredTracks.length - 1;
  renderTrackList();

  try {
    await loadTranscript(track);
  } catch (error) {
    transcript.textContent = error.message;
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
      transcript.textContent = "Run generate_static_site.py after the TXT files are ready.";
      renderTrackList();
      return;
    }

    renderTrackList();
    await selectTrack(0);
  } catch (error) {
    trackTitle.textContent = "Site data unavailable";
    transcript.textContent = error.message;
  }
}

searchInput.addEventListener("input", applySearch);
previousButton.addEventListener("click", () => selectTrack(state.activeIndex - 1));
nextButton.addEventListener("click", () => selectTrack(state.activeIndex + 1));

initialize();