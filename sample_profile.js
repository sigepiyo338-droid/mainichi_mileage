// sample_profile.js
// アプリを初めて起動したユーザーへ表示されるサンプル設定データです。
// このファイルはGitHubに同期され、全員に共有されます。
const SAMPLE_PROFILE_DATA = {
  totalPoints: 0,
  maxPoints: 0,
  categories: [
    { id: 'c1', name: '① 目標・自己実現（仕事日用）', targetMinutes: 30, executedMinutes: 0, isCompleted: false, icon: '🎯', resetTiming: 'daily', resetDayOfWeek: 1 },
    { id: 'c2', name: '② 目標・自己実現（休日用）', targetMinutes: 45, executedMinutes: 0, isCompleted: false, icon: '🚀', resetTiming: 'daily', resetDayOfWeek: 1 },
    { id: 'c3', name: '③ 日課・習慣（仕事日用）', targetMinutes: 20, executedMinutes: 0, isCompleted: false, icon: '⚡', resetTiming: 'daily', resetDayOfWeek: 1 },
    { id: 'c4', name: '④ 日課・習慣（休日用）', targetMinutes: 30, executedMinutes: 0, isCompleted: false, icon: '🌱', resetTiming: 'daily', resetDayOfWeek: 1 },
    { id: 'c5', name: '⑤ ノルマ・ToDo', targetMinutes: 60, executedMinutes: 0, isCompleted: false, icon: '📋', resetTiming: 'daily', resetDayOfWeek: 1 }
  ]
};
