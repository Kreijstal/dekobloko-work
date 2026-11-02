// Reviewed method names on engine classes whose bodies are token-identical to reviewed methods in other games.
import {group} from './bachelorfridge-name-api.mjs';

group('bc', 'Body is token-identical to the reviewed SoundFilter method of the same name in other FunOrb games.', [
  ['a', '(F)F', 'normalizeFrequency'],
  ['a', '(IF)I', 'computeCoefficients'],
  ['a', '(IIF)F', 'interpolateRadius'],
  ['b', '(IIF)F', 'interpolateFrequency'],
]);
group('bl', 'Body is token-identical to the reviewed ArrayOperations method of the same name in other FunOrb games.', [
  ['a', '([BI[BII)V', 'copy'],
  ['a', '([III)V', 'clearInts'],
  ['a', '([II[III)V', 'copy'],
  ['a', '([Ljava/lang/Object;I[Ljava/lang/Object;II)V', 'copy'],
  ['a', '([ZI[ZII)V', 'copy'],
]);
group('bo', 'Body is token-identical to the reviewed VorbisCodebook method of the same name in other FunOrb games.', [
  ['a', '()I', 'decodeScalar'],
]);
group('dg', 'Body is token-identical to the reviewed SoftwareRasterizer method of the same name in other FunOrb games.', [
  ['a', '()V', 'releaseRasterStorage'],
  ['a', '(III)V', 'setPixel'],
  ['a', '(IIII)V', 'setClip'],
  ['a', '(IIIII)V', 'drawRectangle'],
  ['a', '(IIIIIIII[II[IIIIIIII)V', 'addRadialGlowScanlines'],
  ['a', '([I)V', 'saveClip'],
  ['a', '([III)V', 'setTarget'],
  ['b', '(IIII)V', 'fillCircle'],
  ['b', '(IIIII)V', 'drawVerticalLineAlpha'],
  ['b', '(IIIIII)V', 'fillVerticalGradient'],
  ['b', '([I)V', 'restoreClip'],
  ['c', '(IIII)V', 'intersectClip'],
  ['c', '(IIIII)V', 'fillRectangle'],
  ['d', '()V', 'clear'],
  ['d', '(IIIII)V', 'drawLine'],
  ['e', '(IIII)V', 'drawHorizontalLine'],
  ['e', '(IIIIII)V', 'fillRoundedRectangle'],
  ['f', '(IIII)V', 'drawVerticalLine'],
  ['f', '(IIIIII)V', 'fillRectangleAlpha'],
  ['g', '(IIII)V', 'darkenRectangle'],
  ['g', '(IIIII)V', 'drawHorizontalLineAlpha'],
  ['h', '(IIII)V', 'addPixel'],
  ['i', '(IIII)V', 'grayscaleRectangle'],
  ['f', '(IIIII)V', 'fillCircleAlpha'],
]);
group('dv', 'Body is token-identical to the reviewed VorbisSample method of the same name in other FunOrb games.', [
  ['a', '()I', 'readBit'],
  ['a', '(I)I', 'readBits'],
  ['a', '([I)Lbe;', 'decodeToPcm'],
  ['b', '()Lbe;', 'decodeAllToPcm'],
  ['c', '(I)F', 'unpackFloat'],
]);
group('ee', 'Body is token-identical to the reviewed IndexedSprite method of the same name in other FunOrb games.', [
  ['a', '()Lkv;', 'toRgbSprite'],
  ['a', '([I[B[IIIIIII)V', 'copyPaletteRows'],
  ['a', '([I[B[IIIIIIII)V', 'blendPaletteRowsWithAlpha'],
  ['b', '([I[B[IIIIIIII)V', 'copyNonzeroPaletteRows'],
]);
group('fea', 'Body is token-identical to the reviewed BinaryBitmapFont method of the same name in other FunOrb games.', [
  ['a', '(IIIIIIIZ)V', 'drawGlyphAlpha'],
  ['a', '([I[BIIIIIII)V', 'blitBinaryGlyph'],
  ['a', '([I[BIIIIIIII)V', 'blitBinaryGlyphWithAlpha'],
  ['a', '([I[BIIIIIIIII[I[I)V', 'blitMaskedGlyph'],
]);
group('jb', 'Body is token-identical to the reviewed TriangleRasterizer method of the same name in other FunOrb games.', [
  ['a', '(II)I', 'scaleHslLightness'],
  ['a', '(IIIIIII)V', 'drawFlatTriangle'],
  ['a', '(IIIIIIIII)V', 'drawShadedTriangle'],
  ['b', '(II)V', 'setProjectionCenter'],
]);
group('je', 'Body is token-identical to the reviewed PcmSampleStream method of the same name in other FunOrb games.', [
  ['a', '(III)V', 'rampVolumeAndPan'],
  ['a', '(I[B[IIIIIIIIIILje;)I', 'mixReverseStereoAlignedRamp'],
  ['a', '(I[B[IIIIIIIILje;)I', 'mixReverseStereoAligned'],
  ['a', '(Lbe;II)Lje;', 'createWithVolume'],
  ['a', '(Lbe;III)Lje;', 'createAtStepQ8'],
  ['a', '([B[IIIIIIIILje;)I', 'mixForwardMonoAlignedRamp'],
  ['a', '([B[IIIIIIILje;)I', 'mixForwardMonoAligned'],
  ['b', '(I)V', 'setSamplePositionFixed'],
  ['b', '(II)V', 'setVolumeAndPan'],
  ['b', '(I[B[IIIIIIIIIILje;)I', 'mixForwardStereoAlignedRamp'],
  ['b', '(I[B[IIIIIIIILje;)I', 'mixForwardStereoAligned'],
  ['b', '([B[IIIIIIIILje;)I', 'mixReverseMonoAlignedRamp'],
  ['b', '([B[IIIIIIILje;)I', 'mixReverseMonoAligned'],
  ['c', '()I', 'getPriority'],
  ['c', '(I)V', 'fadeOutAndUnlink'],
  ['c', '(II)I', 'rightGain'],
  ['d', '(II)I', 'leftGain'],
  ['e', '(I)V', 'setSampleStepMagnitude'],
  ['j', '()V', 'refreshGains'],
  ['k', '()V', 'cancelRamp'],
  ['b', '(Z)V', 'setReverse'],
]);
group('kd', 'Body is token-identical to the reviewed SoundEnvelope method of the same name in other FunOrb games.', [
  ['a', '()V', 'reset'],
  ['a', '(I)I', 'advance'],
]);
group('kv', 'Body is token-identical to the reviewed Sprite method of the same name in other FunOrb games.', [
  ['a', '()Lkv;', 'copy'],
  ['a', '(II)V', 'drawMultiply'],
  ['a', '(III[I[IIIIIIIII)V', 'addPixelsSaturating'],
  ['a', '(III[I[IIIIIIIIII)V', 'addPixelsSaturatingScaled'],
  ['a', '([IIIIIIII)V', 'drawHalfSizePixels'],
  ['a', '([I[IIIIIII)V', 'copyOpaqueRows'],
  ['a', '([I[IIIIIIII)V', 'copyNonzeroPixels'],
  ['a', '([I[IIIIIIIII)V', 'copyNonzeroPixelsDimmed'],
  ['a', '([I[IIIIIIIIIII)V', 'tintNeutralPixels'],
  ['b', '(II)V', 'drawVerticalFlip'],
  ['b', '(IIIII)V', 'drawScaledSilhouette'],
  ['b', '([I[IIIIIIII)V', 'blitBinaryGlyph'],
  ['b', '([I[IIIIIIIII)V', 'blendPixelsWithAlpha'],
  ['b', '([I[IIIIIIIIIIII)V', 'blitScaledSilhouette'],
  ['c', '()V', 'flipVertically'],
  ['c', '(III)V', 'drawSilhouette'],
  ['c', '(IIII)V', 'drawScaled'],
  ['c', '(IIIII)V', 'drawScaledAlpha'],
  ['c', '([I[IIIIIIIII)V', 'recolorNeutralPixels'],
  ['d', '()V', 'trimTransparentBorders'],
  ['d', '(II)V', 'drawQuarterSize'],
  ['d', '(III)V', 'drawAdditive'],
  ['d', '(IIIII)V', 'sampleBilinear'],
  ['e', '()V', 'flipHorizontal'],
  ['e', '(II)V', 'draw'],
  ['f', '()V', 'rotateClockwise'],
  ['f', '(I)V', 'addOutline'],
  ['f', '(II)V', 'drawHalfSize'],
  ['f', '(III)V', 'drawGrayModulated'],
  ['g', '()V', 'normalizeCanvas'],
  ['h', '()Lkv;', 'copyFlippedHorizontal'],
]);
group('le', 'Body is token-identical to the reviewed MeshData method of the same name in other FunOrb games.', [
  ['a', '()V', 'buildSkinGroups'],
  ['a', '(IIIII)Lgga;', 'createModel'],
]);
group('mga', 'Body is token-identical to the reviewed VorbisFloor method of the same name in other FunOrb games.', [
  ['a', '(II)V', 'sortPoints'],
  ['a', '(IIIII)I', 'interpolatePoint'],
  ['a', '(IIII[FI)V', 'applyLine'],
  ['a', '([II)I', 'highNeighbour'],
  ['b', '([II)I', 'lowNeighbour'],
]);
group('na', 'Body is token-identical to the reviewed JavaSoundAudioOutput method of the same name in other FunOrb games.', [
  ['a', '()I', 'getQueuedFrames'],
  ['a', '(Ljava/awt/Component;)V', 'initDevice'],
  ['e', '()V', 'flushDevice'],
  ['h', '()V', 'closeDevice'],
  ['g', '()V', 'writeDevice'],
]);
group('pa', 'Body is token-identical to the reviewed ArgbSprite method of the same name in other FunOrb games.', [
  ['a', '(IIIIII)V', 'rotateNearest'],
  ['b', '(II)V', 'drawVerticalFlip'],
  ['b', '(III[I[IIIIIIIIII)V', 'addArgbRows'],
  ['c', '(IIII)V', 'drawScaled'],
  ['c', '(IIIII)V', 'drawScaledAlpha'],
  ['c', '([I[IIIIIIII)V', 'blendArgbRows'],
  ['c', '([I[IIIIIIIIIII)V', 'blitArgbScaled'],
  ['c', '([I[IIIIIIIIIIII)V', 'blitArgbScaledAlpha'],
  ['d', '(II)V', 'drawQuarterSize'],
  ['d', '(III)V', 'drawAdditive'],
  ['d', '([I[IIIIIIIII)V', 'blendShadedGrayscaleRows'],
  ['d', '([I[IIIIIIIIIII)V', 'blendTintedGrayscaleRows'],
  ['f', '(II)V', 'drawHalfSize'],
  ['f', '(III)V', 'drawGrayModulated'],
  ['f', '([I[IIIIIIIII)V', 'blitArgbAlpha'],
  ['i', '()Lpa;', 'copyArgb'],
]);
group('pb', 'Body is token-identical to the reviewed AudioOutput method of the same name in other FunOrb games.', [
  ['b', '(I)V', 'skipFrames'],
  ['a', '(IZI)V', 'configure'],
]);
group('pca', 'Body is token-identical to the reviewed Bzip2Decoder method of the same name in other FunOrb games.', [
  ['a', '(ILbv;)I', 'readBits'],
  ['a', '(Lbv;)V', 'buildSymbolMap'],
  ['a', '([I[I[I[BIII)V', 'buildHuffmanTables'],
  ['c', '(Lbv;)V', 'emitBlock'],
]);
group('po', 'Body is token-identical to the reviewed BitmapFont method of the same name in other FunOrb games.', [
  ['a', '(III)V', 'resetStyle'],
  ['a', '(Ljava/lang/String;I)V', 'prepareJustification'],
  ['a', '(Ljava/lang/String;II)I', 'measureWrappedHeight'],
  ['a', '(Ljava/lang/String;IIIIIIIII)I', 'drawParagraph'],
  ['a', '([Lth;[I)V', 'setInlineSprites'],
  ['b', '(Ljava/lang/String;IIIII)V', 'drawLeftAlpha'],
  ['c', '(Ljava/lang/String;)Ljava/lang/String;', 'escapeMarkup'],
  ['a', '([B)V', 'decodeMetrics'],
  ['c', '(Ljava/lang/String;IIII)V', 'drawText'],
  ['a', '([[B[[B[I[I[III)I', 'computePairKerning'],
]);
group('qj', 'Body is token-identical to the reviewed VorbisResidue method of the same name in other FunOrb games.', [
  ['a', '([FIZ)V', 'decodeResidue'],
]);
group('sba', 'Body is token-identical to the reviewed AntialiasedBitmapFont method of the same name in other FunOrb games.', [
  ['a', '([I[BIIIIIII)V', 'blitCoverageGlyph'],
  ['a', '([I[BIIIIIIII)V', 'blitCoverageGlyphWithAlpha'],
]);
group('sda', 'Body is token-identical to the reviewed SynthInstrument method of the same name in other FunOrb games.', [
  ['a', '()V', 'releaseScratch'],
  ['a', '(III)I', 'evaluateWaveform'],
]);
group('ss', 'Body is token-identical to the reviewed ModelMesh method of the same name in other FunOrb games.', [
  ['a', '(II)I', 'scaleHslLightness'],
  ['a', '(III)V', 'scaleGeometry'],
  ['b', '()V', 'calculateBounds'],
  ['c', '(I)I', 'clampHslLightness'],
]);
group('uka', 'Body is token-identical to the reviewed ImageProducerRasterBuffer method of the same name in other FunOrb games.', [
  ['b', '(I)V', 'pushPixels'],
]);
group('vga', 'Body is token-identical to the reviewed MidiFileReader method of the same name in other FunOrb games.', [
  ['a', '()V', 'release'],
  ['e', '()Z', 'isDone'],
  ['g', '()I', 'nextTrack'],
]);
group('vp', 'Body is token-identical to the reviewed SoundEffect method of the same name in other FunOrb games.', [
  ['b', '()Lbe;', 'toPcmSample'],
]);
group('pia', 'Body is token-identical to the reviewed PalettedBitmapFont method of the same name in other FunOrb games.', [
  ['a', '(I[I[B[IIIIIII)V', 'blitPalettedGlyph'],
  ['a', '(I[I[B[IIIIIIII)V', 'blitPalettedGlyphWithAlpha'],
]);
