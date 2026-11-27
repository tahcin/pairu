import { navigate } from "../App";
import { DocBar, DocFoot } from "./Doc";
import "./pages.css";

const link = (path: string) => (e: React.MouseEvent) => {
  e.preventDefault();
  navigate(path);
};

export function About() {
  return (
    <div className="app doc">
      <DocBar here="/about" />
      <main className="main prose">
        <h1>How Pairu works</h1>
        <p>
          Pairu (పైరు, Telugu for a standing crop) helps a farmer who sees a sick leaf. They pick their language and their crop, take a photo, and can
          also say what they see in their own words. Pairu then tells them, in that language and out loud, what the disease most likely is, how sure it
          is, which signs to check, what to do now, how to prevent it next time and whether the weather is right for spraying.
        </p>

        <h2>How Pairu decides</h2>
        <ol className="pipeline">
          <li>
            <strong>Photo and words.</strong> The farmer picks a crop (or says they are not sure), takes a photo, and can describe the problem
            by voice in their own language. The photo is shrunk to at most 1024 pixels on the phone.
          </li>
          <li>
            <strong>A closed list.</strong> A vision model sees the photo for the first look: Gemini 3.1 Flash Lite, falling back to Gemini 3.5
            Flash Lite, then Gemma 4, then Claude Haiku (at most 40 calls a day). The second look uses Gemini 3.5 Flash Lite first. This is the
            setup our published accuracy numbers were measured with. It sees the photo with the list of problems we hold for that crop and must answer in strict JSON, choosing only ids from that
            list, a healthy option or "unknown". It also says whether the photo is sharp and whether it shows the crop the farmer chose.
          </li>
          <li>
            <strong>Code applies the thresholds.</strong> A first look scoring 0.9 or more is accepted (the threshold was chosen on one half of
            the test photos only). Between 0.4 and 0.9, the model takes a second look at the same photo and answers yes, no or cannot tell to
            questions that tell the candidates apart; code keeps a disease only if its sign is seen and nothing rules it out, and shows a single
            survivor as a best guess. The model never decides this itself.
          </li>
          <li>
            <strong>Follow-up questions.</strong> Signs the photo cannot settle become one to three yes or no questions for the farmer (for
            example, whether the spots have rings like a target), and the answers decide. A tie stays unsure.
          </li>
          <li>
            <strong>Refusal path.</strong> If the photo is blurry or too far, shows a different crop, or the answers do not settle it, Pairu says
            plainly that it is not sure and offers a retake or a free call to the Kisan Call Centre (1800-180-1551) instead of guessing.
          </li>
          <li>
            <strong>Advice joined with the government register.</strong> The diagnosis is joined on the exact crop and pest with the CIB&amp;RC
            register of approved uses. Banned, withdrawn and crop-restricted products are removed, WHO class Ia and Ib products carry a warning,
            organic and biological options come first, and each product shows its approved dose, water volume and waiting period before harvest.
            For virus diseases Pairu explains that the approved sprays target the insect that spreads the virus.
          </li>
        </ol>

        <h2>Data behind it</h2>
        <ul>
          <li>2,806 approved uses for our 13 crops, out of 4,454 rows in the CIB&amp;RC "Major Uses of Pesticides" lists for fungicides, insecticides, bio-fungicides and bio-insecticides.</li>
          <li>96 banned, withdrawn and restricted entries from the CIB&amp;RC list of banned, refused and restricted pesticides, applied at the moment advice is built. Streptomycin + tetracycline products are also hidden: they are proposed for a ban on crop use by the Government of India (draft order S.O. 5295(E), 2021, no final notification found) and are not recommended.</li>
          <li>WHO 2019 hazard classes for 160 active ingredients. A missing class is shown as no class, never as safe.</li>
          <li>77 diseases and pests across 13 crops (paddy, cotton, chilli, groundnut, maize, tomato, brinjal, banana, mango, black gram, potato, onion and cashew), plus a healthy entry for each crop, with symptoms, photo cues, prevention, practices and sources from TNAU Agritech, ICAR, NIPHM and DPPQS pages, "should I spray yet?" thresholds for 19, and 48 follow-up questions for look-alike pairs.</li>
          <li>24 Krishi Vigyan Kendras for the 26 Andhra Pradesh districts, from ANGRAU, Dr. YSR Horticultural University and ICAR lists.</li>
        </ul>

        <h2>Limits, stated plainly</h2>
        <ul>
          <li>Pairu only knows the 77 problems in its list. Anything else should come back as "not sure", and the vision model can still be wrong.</li>
          <li>Lab photos of single leaves are easier than photos taken in a field; the evidence page reports both where we have them.</li>
          <li>Some doses in the government lists are printed without a unit. Pairu then converts only the number and tells the farmer to check grams or millilitres on the label.</li>
          <li>Telugu disease text was drafted by machine translation and then checked by an AI model (Claude) against a farming glossary; it has not yet been reviewed by an agronomist. The other languages are machine translated (Gemini) and not yet reviewed by a person.</li>
          <li>Pests are judged from the damage a leaf photo shows, which is weaker than seeing the insect.</li>
          <li>The CIB&amp;RC lists say they are for guidance and not for legal purposes, so Pairu always tells the farmer to follow the product label.</li>
        </ul>

        <h2>In the farmer's own language</h2>
        <p>
          The whole interface, not just the answer, works in Telugu, Hindi, Tamil, Kannada, Marathi, Bengali, Odia, Gujarati, Punjabi, Malayalam
          and English. Telugu and Hindi interface strings were written by hand and the others were machine translated once. Disease guidance is
          served from stored translations for every language, the farmer can speak instead of typing, and the full answer can be read aloud,
          with Sarvam&rsquo;s speech and voice when available and the phone&rsquo;s own voice otherwise. A WhatsApp button sends a short summary
          to family or the local dealer. A side by side check of a general AI&rsquo;s spray advice against the register is on the{" "}
          <a href="/compare" onClick={link("/compare")}>
            Plain AI vs Pairu
          </a>{" "}
          page.
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

        <h2>Sample photos</h2>
        <p>
          The "Try a sample photo" link on the photo screen opens six real labelled photos that are not part of the evaluation test set: four
          single-leaf lab photos from PlantVillage (Mohanty et al. 2016, CC BY-SA 3.0, github.com/spMohanty/PlantVillage-Dataset: tomato late blight, tomato Septoria leaf spot, tomato yellow leaf curl virus, potato early blight) and two rice field photos from Rice Leaf Disease Image Samples
          (Sethy et al. 2020, Mendeley Data, doi 10.17632/fwcj7stb8r, CC BY 4.0: blast, brown spot). The images are unchanged.
        </p>

        <h2>Photograph on the home page</h2>
        <p>
          Rice paddy at Dusipeta, Amadalavalasa mandal, Srikakulam district, by K.Venkataramana, from{" "}
          <a href="https://commons.wikimedia.org/wiki/File:Rice_paddy_fields_at_Dusipeta,_Amadalavalasa_Mandal.Srikakulam_district.jpg">Wikimedia Commons</a>,
          licensed <a href="https://creativecommons.org/licenses/by-sa/4.0">CC BY-SA 4.0</a>. It is shown cropped and converted to WebP.
        </p>

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
        <DocFoot />
      </main>
    </div>
  );
}
