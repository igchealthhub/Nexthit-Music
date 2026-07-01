export function getSongCoverImage(song) {
  return song?.cover_url || song?.cover_art_url || null
}

export function withSongCoverUrl(song) {
  if (!song) return song

  const coverImage = getSongCoverImage(song)
  if (!coverImage || song.cover_url) return song

  return {
    ...song,
    cover_url: coverImage,
  }
}
