/**
 * 後方互換シム — すべて categoryDictionary.js から re-export
 * onboardingHandler.js 等の既存 import を壊さないために残す
 */

export {
  getCategoryGroup,
  getAllCategories,
  getCategoryGroupNames,
  getCategoryGroupByNumber,
  getCategoriesByGroup,
  getCategoryByNumber,
  generateGroupSelectionMessage,
  generateDetailCategoryMessage,
} from './categoryDictionary.js';

// 旧 CATEGORY_GROUPS オブジェクト形式（{ '美容系': ['ネイルサロン', ...] }）も維持
import { CATEGORY_GROUPS as GROUPS_ARRAY, CATEGORIES } from './categoryDictionary.js';

export const CATEGORY_GROUPS = Object.fromEntries(
  GROUPS_ARRAY.map(g => [
    g.label,
    CATEGORIES.filter(c => c.groupId === g.id).map(c => c.label),
  ])
);
