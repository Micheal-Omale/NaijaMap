import React from 'react';
import { Composition } from 'remotion';
import { BeforeTheLines } from './film/BeforeTheLines';
import { FPS, H, TOTAL_FRAMES, W } from './film/config';

export const Root: React.FC = () => (
	<Composition id="BeforeTheLines" component={BeforeTheLines} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} defaultProps={{ siteUrl: 'histonaija.logfolio.pro' }} />
);
