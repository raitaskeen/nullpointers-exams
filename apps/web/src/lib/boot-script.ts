/**
 * Runs before first paint (inlined in <head> by the root layout): applies the saved brand palette
 * so there is no flash of the wrong color.
 * Must live in a plain module - a value exported from a "use client" file reaches a server component as a
 * client-reference proxy, not as this string.
 */
export const bootScript = [
  `try{var p=localStorage.getItem("np-palette");if(p)document.documentElement.dataset.palette=p}catch(e){}`,
  
].join("");
