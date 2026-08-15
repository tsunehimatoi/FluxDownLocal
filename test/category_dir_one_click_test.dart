// 「一键分类目录」的目录名推导 —— 覆盖 custom_category.dart 里的两个纯函数
// sanitizeCategoryDirName / categoryDirUnder（100% 真实生产代码，直接调用）。
//
// 这两个函数是桌面与 Web 的共同契约：同一台机器上两端一键出来的目录必须逐字
// 一致，镜像实现在 web/src/lib/categories.ts。用例里的分隔符一律显式注入，
// 让断言在任何宿主平台上都成立。
//
// 编排层（SettingsProvider.applyCategorySaveDirs / categorySaveDirsApplied）
// 无法直接测：构造 SettingsProvider 会触发 _saveToRust 的 FFI 调用（同
// category_save_dir_test.dart 记录的限制），因此这里只锁死推导规则本身，
// 编排只是「跳过 all + 逐个赋值」的循环。

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:flux_down/src/models/custom_category.dart';

void main() {
  group('sanitizeCategoryDirName', () {
    test('普通分类名原样保留', () {
      expect(sanitizeCategoryDirName('视频'), '视频');
      expect(sanitizeCategoryDirName('Video'), 'Video');
      expect(sanitizeCategoryDirName('My Books'), 'My Books');
    });

    test('路径分隔符与 Windows 保留字符被剔除并压缩空白', () {
      expect(sanitizeCategoryDirName('a/b'), 'a b');
      expect(sanitizeCategoryDirName(r'a\b'), 'a b');
      expect(sanitizeCategoryDirName('a:*?"<>|b'), 'a b');
      expect(sanitizeCategoryDirName('  spaced   out  '), 'spaced out');
    });

    test('去掉 Windows 会静默丢弃的结尾点与空格', () {
      expect(sanitizeCategoryDirName('report.'), 'report');
      expect(sanitizeCategoryDirName('report... '), 'report');
    });

    test('净化后为空时返回空串（调用方据此跳过该分类）', () {
      expect(sanitizeCategoryDirName(''), '');
      expect(sanitizeCategoryDirName('   '), '');
      expect(sanitizeCategoryDirName('///'), '');
      expect(sanitizeCategoryDirName('...'), '');
    });
  });

  group('categoryDirUnder', () {
    test('POSIX：默认目录下拼同名子目录', () {
      expect(
        categoryDirUnder('/home/u/Downloads', '视频', separator: '/'),
        '/home/u/Downloads/视频',
      );
    });

    test('Windows：用反斜杠拼接', () {
      expect(
        categoryDirUnder(r'D:\Downloads', 'Video', separator: r'\'),
        r'D:\Downloads\Video',
      );
    });

    test('base 结尾的多余分隔符被吃掉，不产生 //', () {
      expect(
        categoryDirUnder('/home/u/Downloads//', '图片', separator: '/'),
        '/home/u/Downloads/图片',
      );
      expect(
        categoryDirUnder('D:\\Downloads\\\\', '图片', separator: r'\'),
        r'D:\Downloads\图片',
      );
    });

    test('根目录本身带分隔符，不再补一个', () {
      expect(categoryDirUnder('/', '音乐', separator: '/'), '/音乐');
    });

    test('盘符根：C:\\ 归一成 C:\\音乐', () {
      expect(categoryDirUnder('C:\\', '音乐', separator: r'\'), r'C:\音乐');
    });

    test('base 为空或分类名不可用时返回空串', () {
      expect(categoryDirUnder('', '视频', separator: '/'), '');
      expect(categoryDirUnder('   ', '视频', separator: '/'), '');
      expect(categoryDirUnder('/home/u', '', separator: '/'), '');
      expect(categoryDirUnder('/home/u', '///', separator: '/'), '');
    });

    test('分类名里的分隔符不会穿透成多级目录', () {
      expect(
        categoryDirUnder('/home/u', '../etc', separator: '/'),
        '/home/u/.. etc',
      );
    });
  });

  // 内置分类显示名同时是「一键分类目录」的目录名，保证全部基线语言均定义了完整分类键。
  group('内置分类显示名：基线语言键存在且非空', () {
    const keys = [
      'categoryVideo',
      'categoryAudio',
      'categoryDocument',
      'categoryImage',
      'categoryProgram',
      'categoryArchive',
      'categoryOther',
    ];

    Map<String, dynamic> load(String path) =>
        jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;

    for (final locale in ['en', 'zh']) {
      test(locale, () {
        final app = load('assets/i18n/$locale.json');
        for (final key in keys) {
          expect(
            app[key],
            isNotNull,
            reason: '$locale: App 必须包含分类键 `$key`',
          );
          expect(
            (app[key] as String).isNotEmpty,
            isTrue,
            reason: '$locale: App 分类键 `$key` 不能为空',
          );
        }
      });
    }
  });
}
