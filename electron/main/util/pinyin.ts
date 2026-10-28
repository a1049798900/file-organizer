// 拼音首字母生成工具
// 使用 pinyin-pro 提取文件名/别名的拼音首字母，用于 FTS5 搜索

import { pinyin } from 'pinyin-pro';

/**
 * 生成字符串的拼音首字母串
 * - 汉字取首字母（小写）
 * - 英文字母保留（小写）
 * - 数字保留
 * - 其他字符忽略
 * - 空白去除
 */
export function getPinyinInitials(text: string): string {
  if (!text) return '';

  const result = pinyin(text, {
    pattern: 'first',
    toneType: 'none',
    type: 'string',
    nonZh: 'consecutive',
  });

  // 小写化，只保留字母数字
  return result.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * 从文件名（不含扩展名）生成拼音首字母
 */
export function getNamePinyin(name: string, alias: string | null): string {
  const target = alias || name;
  // 去掉扩展名
  const dotIndex = target.lastIndexOf('.');
  const baseName = dotIndex > 0 ? target.slice(0, dotIndex) : target;
  return getPinyinInitials(baseName);
}
