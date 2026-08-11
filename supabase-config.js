(function () {
  "use strict";

  var config = {
    url: "https://uasodyhfuyidlwojcugp.supabase.co",
    publishableKey: "sb_publishable_nL4Y6wKS_wR1v2fYmGQp0A_fHBrrON3"
  };

  var client = null;

  window.SITE_SUPABASE_CONFIG = Object.freeze(config);
  window.getSiteSupabase = function getSiteSupabase() {
    if (client) {
      return client;
    }

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      return null;
    }

    client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

    return client;
  };
}());
