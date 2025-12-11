# VHS Demo for opencode-direnv
# Run: nix-shell -p vhs ffmpeg --run "vhs demo.tape"

Output demo.gif

Set Shell "bash"
Set FontSize 16
Set Width 1000
Set Height 600
Set Theme "Catppuccin Mocha"
Set Padding 20
Set TypingSpeed 75ms

# Start in a project with .envrc
Type "cd /tmp/demo-project && cat .envrc"
Enter
Sleep 2s

# Start opencode
Type "opencode"
Enter
Sleep 4s

# Ask if direnv is loaded
Type "Is direnv loaded?"
Enter
Sleep 5s
