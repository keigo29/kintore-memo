import type { MuscleGroup } from './muscleGroups'

// 最初から入っている種目。bw は自重（重量を入れない）
// 「その他」は空のまま（自分で追加する用）
export const SEED_EXERCISES: { name: string; group: MuscleGroup; bw?: boolean }[] = [
  // 胸
  { name: 'ベンチプレス', group: 'chest' },
  { name: 'インクラインベンチプレス', group: 'chest' },
  { name: 'ダンベルプレス', group: 'chest' },
  { name: 'ダンベルフライ', group: 'chest' },
  { name: 'チェストプレス（マシン）', group: 'chest' },
  { name: '腕立て伏せ', group: 'chest', bw: true },
  // 背中
  { name: 'デッドリフト', group: 'back' },
  { name: 'ラットプルダウン', group: 'back' },
  { name: 'ベントオーバーロウ', group: 'back' },
  { name: 'シーテッドロウ', group: 'back' },
  { name: 'ワンハンドロウ', group: 'back' },
  { name: '懸垂', group: 'back', bw: true },
  // 肩
  { name: 'ショルダープレス', group: 'shoulders' },
  { name: 'サイドレイズ', group: 'shoulders' },
  { name: 'フロントレイズ', group: 'shoulders' },
  { name: 'リアレイズ', group: 'shoulders' },
  { name: 'アップライトロウ', group: 'shoulders' },
  // 腕
  { name: 'バーベルカール', group: 'arms' },
  { name: 'ダンベルカール', group: 'arms' },
  { name: 'ハンマーカール', group: 'arms' },
  { name: 'トライセプスエクステンション', group: 'arms' },
  { name: 'ケーブルプッシュダウン', group: 'arms' },
  { name: 'ディップス', group: 'arms', bw: true },
  // 下半身（脚とお尻）
  { name: 'スクワット', group: 'legs' },
  { name: 'レッグプレス', group: 'legs' },
  { name: 'ルーマニアンデッドリフト', group: 'legs' },
  { name: 'ブルガリアンスクワット', group: 'legs' },
  { name: 'レッグエクステンション', group: 'legs' },
  { name: 'レッグカール', group: 'legs' },
  { name: 'ヒップスラスト', group: 'legs' },
  { name: 'カーフレイズ', group: 'legs' },
  // 体幹
  { name: 'クランチ', group: 'core', bw: true },
  { name: 'レッグレイズ', group: 'core', bw: true },
  { name: 'アブローラー', group: 'core', bw: true },
  { name: 'ケーブルクランチ', group: 'core' },
]
