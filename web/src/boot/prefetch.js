window.__planumAssets = window.__planumAssets || {};
(function () {
  var params = new URLSearchParams(location.hash.replace(/^#/, ''));
  var atlas =
    {
      desikan: 'cortex-desikan.glb',
      'hcp-mmp': 'cortex-hcp-mmp.glb',
      julich: 'cortex-julich.glb',
      schaefer: 'cortex-schaefer.glb',
    }[params.get('atlas')] || 'cortex-destrieux.glb';
  var detail =
    { aseg: 'structures.glb', nextbrain: 'nextbrain.glb', learning: 'learning.glb' }[
      params.get('detail')
    ] || 'learning.glb';
  // The published root (build/site.ts ASSET_BASE), so a missing trailing slash
  // on the page URL cannot send 25 MB at the site root.
  var root = __ASSET_BASE__;
  // Each file's own content version, written in by the build (build/published-files.ts).
  // Keyed by the plain URL, fetched with that version, as `fetchPublished` does.
  var versions = __PUBLISHED_VERSIONS__;
  function start(file, after) {
    var url = new URL(root + file, location.origin).href;
    var request = function () {
      return fetch(url + '?v=' + versions[file], { cache: 'no-cache', priority: 'high' });
    };
    if (!window.__planumAssets[url]) {
      window.__planumAssets[url] = after ? after.then(request, request) : request();
    }
    return window.__planumAssets[url];
  }
  // Each brain publishes its own directory, so which one must be known
  // before anything of it is worth fetching. A link may name it; if not,
  // the index does, and it is small enough to wait for.
  function warm(brain) {
    var models = 'models/' + brain + '/';
    start(models + 'manifest.json');
    // The cortex is drawn on its own as soon as it is in, so the internal anatomy does not share
    // its bandwidth: its request waits for the cortex's last byte (read from a copy; the app reads
    // the original). A failed cortex is the app's to report, and the internal anatomy still starts.
    var cortex = start(models + atlas).then(function (response) {
      return response.clone().body.pipeTo(new WritableStream());
    });
    start(models + detail, cortex);
  }
  var named = params.get('anatomy');
  var index = start('models/anatomies.json');
  if (named) warm(named);
  else {
    // The app reads the index from this same entry, so it gets the response only once the
    // brain's files have started: it cannot ask for the manifest first and fetch it twice.
    // An index that does not parse, or names no brain, is the app's to report, so the response
    // still goes through.
    window.__planumAssets[new URL(root + 'models/anatomies.json', location.origin).href] =
      index.then(function (response) {
        return response
          .clone()
          .json()
          .then(function (published) {
            warm(published.default);
          })
          .catch(function () {})
          .then(function () {
            return response;
          });
      });
  }
})();
