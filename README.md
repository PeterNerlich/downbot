# downbot
Download a series of anime episodes or manga chapters from [Proxer.me](https://proxer.me) to view undisturbed in times of a slow internet connection

## Disclaimer
This software should not be used to obtain and distribute content illegally. It's only purpose is to help when viewing online conveniently is impossible. Since ads are not included, please [donate to Proxer.me](http://proxer.me/donate#top) to make up for compensation they had forfeit this way!

## Usage

### Anime
`nodejs anime.js "{`OPTIONS`}" "[`YTDL`]"`

where OPTIONS is an JSON object of:

    anime:       [number]              Proxer ID of anime
    start:       [number]              first episode to start with
    count:       [number]              count of episodes to download
    mirrorpref:  [array] of [string]s  list of preferred mirrors
    output:      [string]              path/file.name to save to, with "#" episode counter
    version:     [number]              0: EngSub, 1: EngDub, 2: GerSub, 3: GerDub

YTDL is an `[array]` of options passed to `youtube-dl`

### Manga
`nodejs manga.js "{`OPTIONS`}"`

where OPTIONS is an JSON object of:

    manga:       [number]              Proxer ID of manga
    start:       [number]              first chapter to start with
    count:       [number]              count of chapters to download
    output:      [string]              path/ to save to, with "#" chapter counter
    version:     [number]              0: English, 1: German

## Dependencies

    "epub-gen": "0.0.13",
    "stream-counter": "^1.0.0",
    "youtube-dl": "^1.10.5"