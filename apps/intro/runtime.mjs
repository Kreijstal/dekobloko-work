import {installBrowserImageDecoder} from '../launcher/browser-loader/browser-image-decoder.mjs';
import {installBrowserInflater} from '../launcher/browser-loader/browser-inflater.mjs';

// Shared by the offline compiler and browser: native signatures and async-ness
// must agree before preparing any method. Preparation never calls these hooks.
export function configureIntro(controller, options) {
  const {jit,...rest}=options;
  Object.assign(controller.options,rest,{prepareBeforeMain:true});
  controller.options.jit={...controller.options.jit,...jit,
    preparationPolicy:{...jit?.preparationPolicy,
      entryMethods:['GeobloxIntro$Browser.main([Ljava/lang/String;)V']}};
}

export function installIntroNatives(jvm, {asset, present}) {
  installBrowserImageDecoder(jvm);
  const decompress=async (bytes,format)=>new Uint8Array(await new Response(
    new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format))).arrayBuffer());
  installBrowserInflater(jvm,{inflate:bytes=>decompress(bytes,'deflate'),
    inflateRaw:bytes=>decompress(bytes,'deflate-raw')});
  jvm.jre.GeobloxIntro={applicationFallback:true,staticMethods:{
    'browserAsset(Ljava/lang/String;)[B':(_jvm,_object,args)=>asset(String(args[0]?.value??args[0])),
    'browserPresent([II)V':async (_jvm,_object,[pixels,tick])=>present(pixels,tick),
  }};
}
