'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Diagnostic exploration only: screenshots and method profiling are excluded
// from acceptance. Game state identities belong here, not in the JVM/cloner.
module.exports = async function profileGeoblox({page, output}) {
  const states = [];
  const started = Date.now();
  const canvas = page.locator('.awt-applet-root canvas[width="640"][height="480"]').last();
  const capture = async label => {
    const state = await page.evaluate(() => {
      const jvm = window.funorbServer.session.debug.debugController.jvm;
      const get = (owner, key) => jvm.classes[owner]?.staticFields.get(key);
      return {current: get('tc', 'field_c:I'), target: get('ai', 'field_p:I'),
        assetsLoaded: get('ib', 'field_a:Z')};
    });
    states.push({label, elapsedMs: Date.now() - started, ...state});
    fs.writeFileSync(path.join(output, 'scenario-states.json'), JSON.stringify(states, null, 2));
    await page.screenshot({path: path.join(output, label + '.png')});
  };
  // Zero is also the uninitialized menu-state default. Require completed
  // asset loading and constructed menu objects before accepting state zero.
  await page.waitForFunction(() => {
    const jvm = window.funorbServer?.session?.debug?.debugController?.jvm;
    const loaded = jvm?.classes.ib?.staticFields.get('field_a:Z');
    const menuArray = jvm?.classes.og?.staticFields.get('field_q:[Lc;');
    const menus = menuArray && jvm.jit.arrayData(menuArray);
    return (loaded === true || loaded === 1) && menus?.length === 9 &&
      menus[0] != null && menus[8] != null &&
      jvm?.classes.tc?.staticFields.get('field_c:I') === 0 &&
      jvm?.classes.ai?.staticFields.get('field_p:I') === 0;
  }, undefined, {timeout: 120000, polling: 100});
  await capture('menu-ready');
  await canvas.click({position: {x: 320, y: 158}});
  await page.waitForTimeout(10000);
  await capture('after-start');
  await canvas.focus();
  await page.keyboard.press('Enter', {delay: 150});
  await page.waitForTimeout(5000);
  await capture('after-enter');
  return {diagnostic: true, states};
};
