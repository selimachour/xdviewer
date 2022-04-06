# xdViewer

## What is it ?

An attempt from a linux web developper at viewing XD files.

## Why ?

Because some of us don't have Macs, don't like Windows, but still need to work with Adobe XD files.

## So what is it exactly ?

This is a simple web with a file input. Once an XD selected, it parses it, displays the list of Artboards. Clicking an artboard displays it as SVG.

## Features

- View XD files locally (no uploading to a remote site)
- Display the Artboards
- Show properties of the various elements on click ... "OH! it's the same color with just some alpha !"

## Bugs

- Images sometimes are not displayed properly (need SVG expert)
- `refSync`s not implemented yet so some parts might be missing

## Todo
- Fix the bugs
- Extracts a list of all font properties combinations which would help with creating unique css classes
- Show css equivalent for properties (`fill: foo` => `background: bar`) 
- Move the unzipping and parsing to a Web Worker
- Add `Interactions`
- ...


