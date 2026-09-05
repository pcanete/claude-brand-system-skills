import assert from "node:assert/strict";
import { chromium } from "playwright";
import { assertPageState } from "./lib/qa-assertions.mjs";
const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage();
  await page.setContent('<button aria-expanded="false">Menu</button><nav hidden>Links</nav>');
  await assertPageState(page,[{selector:"nav",visible:false}]);
  await assert.rejects(assertPageState(page,[{selector:"nav",visible:true}]));
  await page.locator("button").evaluate(button => {
    button.onclick = () => {
      button.setAttribute("aria-expanded", "true");
      document.querySelector("nav").hidden = false;
    };
  });
  await page.locator("button").click();
  await assertPageState(page,[{selector:"button",attributes:{"aria-expanded":"true"}},{selector:"nav",visible:true,text:"Links"}]);
  await assert.rejects(assertPageState(page,[{selector:"button",attributes:{"aria-expanded":"false"}}]));
  await page.locator("nav").evaluate(el => el.style.fontFamily = "MissingBrandFont, sans-serif");
  await assert.rejects(assertPageState(page,[{selector:"nav",font:{family:"MissingBrandFont"}}]));
  console.log("Browser QA detects wrong state and silent font fallback.");
} finally { await browser.close(); }
