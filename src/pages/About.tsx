import { navigate } from "../App";

const link = (path: string) => (e: React.MouseEvent) => {
  e.preventDefault();
  navigate(path);
};

export function About() {
  return (
    <div className="app doc">
      <header className="bar">
        <a className="brand" href="/" onClick={link("/")}>
          <span className="brand-mark" aria-hidden="true" />
          Pairu
        </a>
        <a className="chip" href="/evidence" onClick={link("/evidence")}>
          Evidence
        </a>
      </header>
      <main className="main prose">
        <h1>How Pairu works</h1>
        <p>
          Pairu (పైరు, Telugu for a standing crop) helps a farmer who sees a sick leaf. They pick their language and their crop, take a photo, and can
          also say what they see in their own words. Pairu then tells them, in that language and out loud, what the disease most likely is, how sure it
          is, which signs to check, what to do now, how to prevent it next time and whether the weather is right for spraying.
        </p>

        <h2>The model proposes, code decides</h2>
        <p>
          A vision model (Gemini 3.1 Flash Lite, falling back to Gemini 3.5 Flash Lite and then Claude Haiku) looks at the photo together with the
          closed list of diseases we hold for that crop and must answer in strict JSON, choosing only ids from that list, a healthy option or
          "unknown". It also reports whether the photo is sharp enough and whether it shows the crop the farmer chose.
        </p>
        <p>
          Our code, not the model, then decides what happens. A diagnosis is accepted only when the top candidate scores at least 0.75 and leads the
          next by at least 0.25. When the top two are known look-alikes (early blight and Septoria leaf spot on tomato, for example), Pairu asks the
          farmer one to three yes or no questions written to tell them apart, and the answers decide. If the photo is poor, the crop looks wrong or
          the answers do not settle it, Pairu says plainly that it is not sure and offers a retake or a free call to the Kisan Call Centre
          (1800-180-1551) instead of guessing.
        </p>

        <h2>Only treatments the Government of India approves for that crop</h2>
        <p>
          Every chemical and biological product shown comes from the CIB&amp;RC "Major Uses of Pesticides" lists, joined on the exact crop and the
          exact pest or disease, with the approved dose, the water volume and the waiting period before harvest. Doses are converted to per acre
          only when the list prints a plain number; otherwise they are shown exactly as printed per hectare. Products on the government's banned,
          withdrawn or crop-restricted list are removed, and products whose active ingredient is in WHO hazard class Ia or Ib carry a clear
          warning. Organic and biological options are listed first. The CIB&amp;RC lists say they are for guidance and not for legal purposes, so
          Pairu also tells the farmer to follow the product label.
        </p>

        <h2>In the farmer's own language</h2>
        <p>
          The whole interface, not just the answer, works in Telugu, Hindi, Tamil, Kannada, Marathi, Bengali, Odia, Gujarati, Punjabi, Malayalam
          and English. Telugu and Hindi strings were written by hand; the others were translated once with Sarvam. Disease guidance is translated
          with Sarvam Translate, the farmer can speak instead of typing (Sarvam speech to text), and the full answer can be read aloud (Sarvam
          Bulbul). A WhatsApp button sends a short summary to family or the local dealer.
        </p>

        <h2>Sources</h2>
        <ul>
          <li>
            <a href="https://ppqs.gov.in/divisions/cib-rc/major-uses-of-pesticides">CIB&amp;RC, Major Uses of Pesticides</a> and the list of banned,
            refused and restricted pesticides
          </li>
          <li>
            <a href="https://iris.who.int/handle/10665/332193">WHO Recommended Classification of Pesticides by Hazard (2019)</a>
          </li>
          <li>Disease symptoms, prevention and practices from public ICAR, TNAU Agritech and state agriculture pages, cited on each advice card</li>
          <li>
            <a href="https://open-meteo.com/">Open-Meteo</a> for the spray-weather check (no spraying if 1 mm or more of rain is forecast in the next
            24 hours or the wind is above 15 km/h)
          </li>
        </ul>

        <h2>How well it works</h2>
        <p>
          We test Pairu on held-out labelled leaf photos and publish the result, with the size of the test set and its limits, on the{" "}
          <a href="/evidence" onClick={link("/evidence")}>
            evidence page
          </a>
          . Lab photos on plain backgrounds are easier than photos taken in a field, and we say so there.
        </p>

        <h2>Privacy</h2>
        <p>
          Photos are sent to Google's Gemini API to make the diagnosis. Pairu uses Gemini's free tier, whose terms allow Google to use inputs to
          improve its products, so farmers should photograph only the leaf. Pairu keeps no account and no profile, and stores only the diagnosis
          result in a short-lived cache keyed by a hash of the photo, so the same photo is not sent twice. Location is asked for only to check the
          spray weather and is never stored.
        </p>
        <p className="muted small">Built for Avishkaar Season 4, problem statement AG-03, by team Solus.</p>
      </main>
    </div>
  );
}
