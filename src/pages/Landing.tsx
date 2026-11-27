// Landing page for judges. Wide windows with WebGL get the scroll film; narrow windows (at /home),
// reduced motion and browsers without WebGL get the same story as a static page.
import { useEffect, useState } from "react";
import { Film, Story } from "./landing/Film";
import { webglAvailable } from "./landing/glcheck";

function canFilm() {
  try {
    return window.innerWidth >= 900 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches && webglAvailable();
  } catch {
    return false;
  }
}

export function Landing() {
  const [film] = useState(canFilm);
  useEffect(() => {
    document.documentElement.lang = "en";
    document.title = "Pairu: crop advice limited to what the Government of India has approved";
    return () => {
      document.title = "Pairu";
    };
  }, []);
  return film ? <Film /> : <Story />;
}
