import { Config } from '@remotion/cli/config';

// The film's footage lives outside public/, so the site never ships it.
Config.setPublicDir('film-public');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setBrowserExecutable('C:/Program Files/Google/Chrome/Application/chrome.exe');
Config.setChromiumOpenGlRenderer('angle');
