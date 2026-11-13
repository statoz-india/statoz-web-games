import { CONSENT_STORAGE_KEY } from "./constants";
import { ConsentBanner } from "./consent-banner";
import { PageViewTracker } from "./page-view-tracker";

// Checked so an env typo can't inject into the inline script.
const GA4_ID = /^G-[A-Z0-9]+$/.test(process.env.NEXT_PUBLIC_GA4_ID ?? "") ? process.env.NEXT_PUBLIC_GA4_ID : undefined;
const GTM_ID = /^GTM-[A-Z0-9]+$/.test(process.env.NEXT_PUBLIC_GTM_ID ?? "") ? process.env.NEXT_PUBLIC_GTM_ID : undefined;

/**
 * Consent defaults, then GA4 (gtag) and GTM, in one parser-run script so the order is fixed
 * and window.gtag exists before any component effect sends an event.
 * GTM must not hold a GA4 tag too, or every event is counted twice.
 */
function setupScript(ga4Id: string | undefined, gtmId: string | undefined) {
  return `(function(){
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
window.gtag=gtag;
var granted=false;try{granted=localStorage.getItem(${JSON.stringify(CONSENT_STORAGE_KEY)})==="granted";}catch(e){}
gtag("consent","default",{analytics_storage:granted?"granted":"denied",ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied"});
function load(src){var s=document.createElement("script");s.async=true;s.src=src;document.head.appendChild(s);}
${ga4Id ? `gtag("js",new Date());gtag("config","${ga4Id}",{send_page_view:false});load("https://www.googletagmanager.com/gtag/js?id=${ga4Id}");` : ""}
${gtmId ? `dataLayer.push({"gtm.start":Date.now(),event:"gtm.js"});load("https://www.googletagmanager.com/gtm.js?id=${gtmId}");` : ""}
})();`;
}

/** Renders nothing unless ENVIRONMENT=production when the app is built. */
export function Analytics() {
  if (process.env.ENVIRONMENT !== "production" || (!GA4_ID && !GTM_ID)) return null;

  return (
    <>
      <script id="statoz-analytics" dangerouslySetInnerHTML={{ __html: setupScript(GA4_ID, GTM_ID) }} />
      <PageViewTracker />
      <ConsentBanner />
    </>
  );
}
