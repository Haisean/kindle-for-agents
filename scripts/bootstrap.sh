#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
user_home="${HOME:?HOME is not set}"
skill_root="$user_home/.agents/skills"
backup_root="$user_home/.agents/skill-backups/kindle-for-agents"

for command_name in node npm; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing $command_name. Install Node.js LTS and run this script again." >&2
    exit 1
  fi
done

cd "$repo_root"
npm ci
npm run build

global_npm_root="$(npm root --global)"
legacy_global_package="$global_npm_root/kindle-bridge"
if [[ -e "$legacy_global_package" || -L "$legacy_global_package" ]]; then
  echo "Migrating the legacy global package link: kindle-bridge"
  npm uninstall --global kindle-bridge
fi
npm link

target_labels=("agents")
target_roots=("$skill_root")

if [[ -d "$user_home/.claude" ]]; then
  target_labels+=("claude")
  target_roots+=("$user_home/.claude/skills")
fi

if [[ -d "$user_home/.gemini/config" || -d "$user_home/.gemini/antigravity" ]]; then
  target_labels+=("gemini")
  target_roots+=("$user_home/.gemini/config/skills")
fi

mkdir -p "$backup_root"
stamp="$(date '+%Y%m%d-%H%M%S')"

for i in "${!target_roots[@]}"; do
  target_label="${target_labels[$i]}"
  target_root="${target_roots[$i]}"

  case "$target_root" in
    "$user_home"/*) ;;
    *)
      echo "The skill destination is outside the current user home: $target_root" >&2
      exit 1
      ;;
  esac

  mkdir -p "$target_root"

  for skill_name in kindle-for-agents kindle-setup send-to-kindle kindle-bridge; do
    source_path="$repo_root/skills/$skill_name"
    destination="$target_root/$skill_name"

    if [[ -e "$destination" || -L "$destination" ]]; then
      backup="$backup_root/$target_label-$skill_name-$stamp"
      mv "$destination" "$backup"
      echo "Backed up existing skill: $backup"
    fi

    cp -R "$source_path" "$destination"
    echo "Installed skill: $skill_name -> $destination"
  done
done

echo
echo "Kindle for Agents is installed for the current macOS user."
echo "Capability status:"
kindle --json capability
echo
echo 'If the state is not ready, ask an Agent to use $kindle-setup.'
