"""Capture real Vice Verano frames from the running static game."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "screenshots"
OUT.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for filename, shot in [("1-cover.jpg", "cover"), ("2-street.jpg", "foot"), ("3-chase.jpg", "chase"), ("4-dialogue.jpg", "dialogue")]:
        page = browser.new_page(viewport={"width": 1280, "height": 720}, device_scale_factor=1)
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(f"http://127.0.0.1:8081/?shot={shot}&seed=23", wait_until="networkidle")
        page.wait_for_function("window.__shotReady === true", timeout=5000)
        page.screenshot(path=str(OUT / filename), type="jpeg", quality=72)
        if errors:
            raise RuntimeError(f"{shot}: {errors}")
        page.close()
    browser.close()
