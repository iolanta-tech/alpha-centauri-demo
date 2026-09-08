import { StagedDemo } from "./demo/staged-demo.js";

let demo;

function syncDemo() {
    const slide = document.querySelector("#graph-slide");
    const shell = slide?.querySelector(".graph-shell");
    if (!shell) return;
    if (!demo) demo = new StagedDemo(shell);
    if (slide.classList.contains("active") || !document.body.classList.contains("shower")) demo.start();
    else demo.stop();
}

window.addEventListener("load", syncDemo);
window.addEventListener("pagehide", () => demo?.dispose());
if (window.shower) {
    window.shower.addEventListener("start", syncDemo);
    window.shower.addEventListener("modechange", syncDemo);
    window.shower.addEventListener("slidechange", syncDemo);
}
syncDemo();
