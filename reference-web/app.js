const form = document.getElementById("bridge-form");
const steps = Array.from(document.querySelectorAll(".step"));
const stepLabel = document.getElementById("step-label");
const stepCount = document.getElementById("step-count");
const progressBar = document.getElementById("progress-bar");

let currentStep = 1;

function showStep(stepNumber) {
  currentStep = Math.min(Math.max(stepNumber, 1), steps.length);

  steps.forEach((step) => {
    const active = Number(step.dataset.step) === currentStep;
    step.hidden = !active;
    step.classList.toggle("is-active", active);
  });

  const activeStep = steps[currentStep - 1];
  stepLabel.textContent = activeStep.dataset.title || `Step ${currentStep}`;
  stepCount.textContent = `${currentStep} of ${steps.length}`;
  progressBar.style.width = `${(currentStep / steps.length) * 100}%`;

  const heading = activeStep.querySelector("h1, h2");
  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function selectedValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(
    (input) => input.value
  );
}

document.querySelectorAll(".next").forEach((button) => {
  button.addEventListener("click", () => showStep(currentStep + 1));
});

document.querySelectorAll(".back").forEach((button) => {
  button.addEventListener("click", () => showStep(currentStep - 1));
});

const accessButton = document.getElementById("access-next");
const accessCode = document.getElementById("access-code");
const consent = document.getElementById("consent");
const codeError = document.getElementById("code-error");

accessButton.addEventListener("click", () => {
  const hasCode = accessCode.value.trim().length > 0;
  const hasConsent = consent.checked;

  codeError.hidden = hasCode;

  if (!hasCode) {
    accessCode.focus();
    return;
  }

  if (!hasConsent) {
    consent.focus();
    return;
  }

  showStep(3);
});

const toggleExamples = document.getElementById("toggle-examples");
const toggleLabels = document.getElementById("toggle-labels");

toggleExamples.addEventListener("change", () => {
  document.body.classList.toggle("hide-examples", !toggleExamples.checked);
});

toggleLabels.addEventListener("change", () => {
  document.body.classList.toggle("hide-labels", !toggleLabels.checked);
});

function showFileNames(input, list) {
  list.replaceChildren();
  Array.from(input.files).forEach((file) => {
    const item = document.createElement("li");
    item.textContent = file.name;
    list.appendChild(item);
  });
}

const contextFiles = document.getElementById("context-files");
const evidenceFiles = document.getElementById("evidence-files");

contextFiles.addEventListener("change", () => {
  showFileNames(contextFiles, document.getElementById("context-list"));
});

evidenceFiles.addEventListener("change", () => {
  showFileNames(evidenceFiles, document.getElementById("evidence-list"));
});

const naturalInput = document.getElementById("natural-input");
const wantedOutcome = document.getElementById("wanted-outcome");
const meaningMap = document.getElementById("meaning-map");

function communicationSummary() {
  const selectedCards = Array.from(
    document.querySelectorAll('input[name="communication"]:checked')
  );

  if (selectedCards.length === 0) {
    return "No communication options selected. The user may still use the bridge.";
  }

  return selectedCards
    .map((input) => {
      const card = input.closest(".choice-card");
      const plain = card.querySelector("strong")?.textContent.trim() || input.value;
      const bracket = card.querySelector(".bracket-label")?.textContent.trim() || "";
      return `• ${plain} ${bracket}`.trim();
    })
    .join("\n");
}

document.getElementById("map-meaning").addEventListener("click", () => {
  const account = naturalInput.value.trim();
  const outcome = wantedOutcome.value.trim();

  meaningMap.value = [
    "WHAT I THINK YOU MEAN",
    account || "Add your account here. The working bridge will map the meaning rather than simply copy it.",
    "",
    "WHAT OUTCOME YOU WANT",
    outcome || "No outcome entered yet.",
    "",
    "COMMUNICATION SUPPORT SELECTED",
    communicationSummary(),
    "",
    "EVIDENCE AND UNCERTAINTY",
    "The working bridge will list the source of each important point and clearly mark anything uncertain or unsupported."
  ].join("\n");

  showStep(6);
});

document.getElementById("focus-meaning").addEventListener("click", () => {
  meaningMap.focus();
  meaningMap.setSelectionRange(meaningMap.value.length, meaningMap.value.length);
});

const destinationNames = {
  healthcare: "NHS, GP or healthcare communication",
  benefits: "PIP, benefits or form answer",
  council: "council or public-service communication",
  housing: "housing communication",
  employment: "employer or reasonable-adjustment communication",
  complaint: "complaint or escalation",
  timeline: "timeline and evidence map",
  personal: "message to a person",
  letter: "email or letter",
  project: "instructions for a larger AI project",
  suggest: "format suggested by the bridge"
};

const draftOutput = document.getElementById("draft-output");

document.getElementById("build-draft").addEventListener("click", () => {
  const destinations = selectedValues("destination");
  const destinationText = destinations.length
    ? destinations.map((item) => destinationNames[item] || item).join(", ")
    : "a format to be chosen";

  draftOutput.value = [
    `DRAFT FOR: ${destinationText.toUpperCase()}`,
    "",
    meaningMap.value.trim() || "No confirmed meaning has been entered.",
    "",
    "PROTOTYPE NOTE",
    "A working BridgeTranslate implementation will convert the confirmed meaning into the chosen format, connect evidence-based statements to their sources, and mark uncertainty rather than inventing missing information."
  ].join("\n");

  showStep(8);
});

document.querySelectorAll("[data-draft-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.draftAction;
    const notes = {
      shorter: "\n\n[Requested change: make this shorter without removing essential meaning.]",
      voice: "\n\n[Requested change: preserve more of the user's own wording and rhythm.]",
      formal: "\n\n[Requested change: use a more formal register without weakening the user's position.]",
      sources: "\n\n[Requested change: identify the source document for each evidence-based point.]"
    };

    draftOutput.value += notes[action] || "";
    draftOutput.focus();
    draftOutput.setSelectionRange(draftOutput.value.length, draftOutput.value.length);
  });
});

const copyStatus = document.getElementById("copy-status");

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const temporary = document.createElement("textarea");
  temporary.value = text;
  temporary.setAttribute("readonly", "");
  temporary.style.position = "fixed";
  temporary.style.opacity = "0";
  document.body.appendChild(temporary);
  temporary.select();
  document.execCommand("copy");
  temporary.remove();
}

document.getElementById("copy-output").addEventListener("click", async () => {
  try {
    await copyText(draftOutput.value);
    copyStatus.textContent = "Copied to clipboard.";
  } catch (error) {
    copyStatus.textContent = "Copy did not work. Select the text and copy it manually.";
  }
});

document.getElementById("download-text").addEventListener("click", () => {
  const blob = new Blob([draftOutput.value], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "bridge-translation.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

document.getElementById("print-output").addEventListener("click", () => {
  window.print();
});

document.getElementById("erase-session").addEventListener("click", () => {
  const confirmed = window.confirm(
    "Erase the active prototype session and return to the welcome screen?"
  );

  if (!confirmed) {
    return;
  }

  form.reset();
  meaningMap.value = "";
  draftOutput.value = "";
  document.getElementById("context-list").replaceChildren();
  document.getElementById("evidence-list").replaceChildren();
  copyStatus.textContent = "";
  codeError.hidden = true;
  document.body.classList.remove("hide-examples", "hide-labels");
  toggleExamples.checked = true;
  toggleLabels.checked = true;
  showStep(1);
});

showStep(1);