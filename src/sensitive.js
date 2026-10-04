/** Paths whose modification deserves a second look because they run code later or hold credentials. */

/** @type {[RegExp, string][]} */
const HOME_RULES = [
  [/^\.(zshrc|zprofile|zshenv|zlogin|bashrc|bash_profile|bash_login|profile)$/, 'shell startup file'],
  [/^\.config\/fish\/config\.fish$/, 'shell startup file'],
  [/^\.ssh\//, 'SSH keys/config'],
  [/^\.(aws|gnupg|kube|docker)\//, 'credentials/config'],
  [/^\.(netrc|npmrc|pypirc|git-credentials)$/, 'credentials'],
  [/^Library\/(LaunchAgents|LaunchDaemons)\//, 'runs at login'],
  [/^\.config\/(systemd\/user|autostart)\//, 'runs at login'],
  [/^\.gitconfig$|^\.config\/git\//, 'git config (aliases/hooks)'],
  [/^\.(claude|codex|cursor|gemini)\//, 'coding-agent config/hooks'],
  [/^\.local\/bin\//, 'adds executables to PATH'],
];

/** @type {[RegExp, string][]} */
const PROJECT_RULES = [
  [/^\.git\/hooks\//, 'git hook (runs on git commands)'],
  [/^\.git\/config$/, 'git config'],
  [/^\.github\/workflows\//, 'CI workflow'],
  [/(^|\/)\.env(\..*)?$/, 'env/secrets file'],
  [/^\.husky\//, 'git hook'],
  [/^\.vscode\/(tasks|launch|settings)\.json$/, 'editor task (can run commands)'],
  [/^(\.mcp\.json|\.claude\/|\.cursor\/|\.codex\/)/, 'coding-agent config'],
];

export function flagsFor(rel, area) {
  const rules = area === 'home' ? HOME_RULES : PROJECT_RULES;
  const flags = [];
  for (const [re, label] of rules) if (re.test(rel) && !flags.includes(label)) flags.push(label);
  return flags;
}
