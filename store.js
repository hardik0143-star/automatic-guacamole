/* Tiny Tiffin — shared data store
   Since this is a static site with no backend yet, "editing" data
   means: keep a draft in this browser (localStorage, with an
   in-memory fallback so it never hard-fails), and let the Admin
   Panel export a finished data/recipes.js you copy back into your
   project when you're ready to publish the changes for everyone.
   See README.md → "Going further with Firebase/Supabase" to make
   this live for every visitor instead of per-browser. */
window.TinyTiffinStore = (function () {
  const DRAFT_KEY = "tt_draft_recipes_v1";
  const memoryStore = {};

  function readDraft() {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      return raw !== null ? JSON.parse(raw) : null;
    } catch (e) {
      return DRAFT_KEY in memoryStore ? memoryStore[DRAFT_KEY] : null;
    }
  }

  function writeDraft(recipes) {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(recipes));
    } catch (e) {
      memoryStore[DRAFT_KEY] = recipes;
    }
  }

  function clearDraft() {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch (e) {
      delete memoryStore[DRAFT_KEY];
    }
  }

  function getRecipes() {
    const draft = readDraft();
    return draft || window.TINY_TIFFIN_RECIPES || [];
  }

  function saveRecipes(recipes) {
    writeDraft(recipes);
  }

  function hasDraft() {
    return readDraft() !== null;
  }

  return { getRecipes, saveRecipes, clearDraft, hasDraft };
})();
