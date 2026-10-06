# Map symbols

Only **two** symbols are PNG art — drop these files in this folder:

| file | label |
|---|---|
| `icp.png` | Incident Command Post |
| `eoc.png` | Emergency Operations Center |

Everything else is drawn as an auto-numbered badge (white circle, red ring),
so no art is needed:

| badge | meaning | numbering |
|---|---|---|
| `S1, S2…` | Staging Area | automatic per incident |
| `C1, C2…` | Camp | automatic per incident |
| `B` | Base | only one allowed — the app blocks a second B |
| `H-1, H-2…` | Helispot | H in regular weight, number bold |
| `H1, H2…` | Helibase | all bold |

Other facilities (Evacuation, Hospital, Media, Kitchen, First Aid, …) are
created by users inside the app: they pick a free letter (S/C/B/H are
reserved) or a shape (`+ ★ ▲ ● ◆ ■`) and type what it means
(e.g. `E` = Evacuation Center). Those definitions are stored per incident
in the database — nothing to set up here.

Until `icp.png` / `eoc.png` are present, they render as labeled placeholder
badges — the page works either way. Square PNGs with transparency work
best; ~96×96 px or larger.
