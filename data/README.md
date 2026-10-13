# Bird-name data

`birds.json` combines the European bird checklist in `europe-species.txt` with common names from the official IOC multilingual list.

## Sources

- [IOC Multilingual World Bird List 15.2](https://worldbirdnames.org/Multiling%20IOC%2015.2.xlsx), edited by Frank Gill, David Donsker and Pamela Rasmussen. Licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). The workbook's `Sources` sheet lists contributors and references for each language.
- [List of birds of Europe](https://en.wikipedia.org/wiki/List_of_birds_of_Europe), used for the European species scope. Its checklist includes rare/accidental and introduced species and follows AviList taxonomy. The article's stated occurrence records run through 2015. The checklist is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- Norwegian names were audited against the preferred names in [Artsdatabanken's Norwegian Taxonomic Register](https://nortaxa.artsdatabanken.no/). Differences are listed in `norwegian-overrides.json` and take precedence over the IOC column.

The checklist has 899 scientific-name entries and all 899 now match an IOC 15.2 species; the app dataset has 899 birds. Three checklist names differ from IOC spelling or synonymy and are mapped in `scripts/build-data.py`: `Helopsaltes fasciolata`, `Phoenicopterus minor`, and `Phyloscopus plumbeitarsus`. The checklist includes rare/accidental species such as *Melanitta deglandi* (amerikasjøorre) and *M. stejnegeri* (sibirsjøorre).

A cross-check of the 898 Norwegian names found 11 preferred-name differences from IOC; the override file uses Artsdatabanken's values. The register also lists *Ninox odiosa* as alvefalkugle, but that species is endemic to New Britain and is not on the European checklist.

## Regenerate

The IOC workbook is included here. Install the Python dependency and run:

```sh
python3 -m pip install -r requirements.txt
python3 scripts/build-data.py
```
