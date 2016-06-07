# downbot
Download a series of anime episodes from [Proxer.me](https://proxer.me) to view undisturbed in times of a slow internet connection

## Usage
`nodejs index.js "{`OPTIONS`}" "[`YTDL`]"`

where OPTIONS is an JSON object of:

    anime:       [number]              Proxer ID of anime
    start:       [number]              first episode to start with
    count:       [number]              count of episodes to download
    mirrorpref:  [array] of [string]s  list of preferred mirrors
    output:      [string]              path/file.name to save to, with "#" episode counter
    version:     [number]              0: EngSub, 1: EngDub, 2: GerSub, 3: GerDub

YTDL is an `[array]` of options passed to `youtube-dl`

## Dependencies
(taken from the `package.json`, not cleaned up → two different YTDL packages?!?)

    "cheerio": "^0.19.0",
    "stream-counter": "^1.0.0",
    "youtube-dl": "^1.10.5",
    "ytdl": "^0.3.12"