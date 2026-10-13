# Birdnames

A fast, offline-capable lookup for bird names in European languages. Type a name in any enabled language; each result shows the bird's names in the selected languages.

## Run locally

From this folder, run:

```sh
python3 -m http.server 8899
```

Open <http://localhost:8899/>. The service worker caches the app and data for offline use after the first load. Install support requires serving the app from HTTPS or localhost.

## Deploy

The site is plain static files with no build step. It is published with GitHub Pages at <https://fyhn.lol/birdnames/>; the `CNAME` file sets the custom domain.

## Data

The app uses IOC World Bird List 15.2 names and taxonomy, matched to a Europe checklist that includes rare and accidental records. The current dataset has 899 species. See [data/README.md](data/README.md) for checklist matching, source citations, licenses, and regeneration steps, and [LICENSES.md](LICENSES.md) for the project's licensing.
