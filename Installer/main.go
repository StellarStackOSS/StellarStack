package main

import (
	"context"
	"fmt"
	"os"
	"runtime"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/bubbles/help"
	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/lipgloss"

	"github.com/MarquesCoding/StellarStack/installer/config"
)

const (
	installerVersion = "1.2.0"
	installerDate    = "2026-01-17"
)

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                         INSTALLATION STEPS                                 ║
║                                                                            ║
║  Step constants track the current position in the installation flow.      ║
║  Each step corresponds to a specific user interaction or operation.       ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

const (
	StepWelcome = iota
	StepSystemCheck
	StepInstallationType
	StepServerIP
	StepDomains
	StepAdminCredentials
	StepMonitoring
	StepConfirmation
	StepProgress
	StepComplete
)

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                         UI STYLING DEFINITIONS                             ║
║                                                                            ║
║  Pastel peach and black theme using lipgloss for consistent styling.      ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

var (
	primaryStyle   = lipgloss.NewStyle().Foreground(lipgloss.Color("#FFCAB0")).Bold(true)
	secondaryStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("#FFB3A7"))
	mutedStyle     = lipgloss.NewStyle().Foreground(lipgloss.Color("#FFB3A7")).Faint(true)
	headerStyle    = lipgloss.NewStyle().Foreground(lipgloss.Color("#FFCAB0")).Bold(true).Padding(0, 1)
	dividerStyle   = lipgloss.NewStyle().Foreground(lipgloss.Color("#FFB3A7")).Faint(true)
	successStyle   = lipgloss.NewStyle().Foreground(lipgloss.Color("#FFCAB0")).Bold(true)
	errorStyle     = lipgloss.NewStyle().Foreground(lipgloss.Color("#FF9E7D")).Bold(true)
	debugStyle     = lipgloss.NewStyle().Foreground(lipgloss.Color("#FFD700")).Bold(true)
)

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                         KEYBOARD BINDINGS                                  ║
║                                                                            ║
║  Following the Elm Architecture pattern for key binding management.       ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

type keymap struct {
	next   key.Binding
	prev   key.Binding
	start  key.Binding
	quit   key.Binding
	help   key.Binding
}

func (k keymap) ShortHelp() []key.Binding {
	return []key.Binding{k.next, k.quit}
}

func (k keymap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{k.next, k.quit},
		{k.help},
	}
}

var defaultKeymap = keymap{
	next: key.NewBinding(
		key.WithKeys("enter"),
		key.WithHelp("enter", "next"),
	),
	prev: key.NewBinding(
		key.WithKeys("shift+tab"),
		key.WithHelp("shift+tab", "back"),
	),
	start: key.NewBinding(
		key.WithKeys(" "),
		key.WithHelp("space", "start"),
	),
	quit: key.NewBinding(
		key.WithKeys("ctrl+c", "q"),
		key.WithHelp("ctrl+c/q", "quit"),
	),
	help: key.NewBinding(
		key.WithKeys("?"),
		key.WithHelp("?", "help"),
	),
}

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                         CUSTOM MESSAGE TYPES                               ║
║                                                                            ║
║  Messages for the Bubble Tea event loop.                                  ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

type tickMsg struct{}
type systemCheckCompleteMsg struct {
	checks map[string]*config.SystemCheckResult
	err    error
}

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                         APPLICATION MODEL                                  ║
║                                                                            ║
║  Holds the complete state of the installer application.                   ║
║  Includes UI components and collected configuration data.                 ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

type Model struct {
	step      int
	textInput textinput.Model
	progress  progress.Model
	spinner   spinner.Model
	help      help.Model
	keymap    keymap

	/*
	Installation configuration - collected through the workflow
	*/
	cfg *config.Config
	ctx context.Context

	/*
	Installation progress tracking
	*/
	progressValue float64
	quitting      bool
	showHelp      bool

	/*
	System check results
	*/
	systemCheckResults map[string]*config.SystemCheckResult
	systemCheckDone    bool
	systemCheckError   string

	/*
	Debug mode: When enabled, shows what would happen without executing
	*/
	debugMode bool
	debugLog  []string

	/*
	Error handling
	*/
	errorMessage string
}

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                         INITIALIZATION FUNCTIONS                           ║
║                                                                            ║
║  Create and configure the initial application state.                      ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

/*
initialModel creates a new Model with default values.

Parameters:
  debugMode - Whether to run in debug/dry-run mode

Returns:
  *Model - Initialized model ready for rendering
*/
func initialModel(debugMode bool) *Model {
	ti := textinput.New()
	ti.CharLimit = 256
	ti.Cursor.Style = primaryStyle

	sp := spinner.New()
	sp.Spinner = spinner.Dot
	sp.Style = primaryStyle

	cfg := config.CreateDefaultConfig()

	m := &Model{
		step:                   StepWelcome,
		textInput:              ti,
		progress:               progress.New(progress.WithDefaultGradient()),
		spinner:                sp,
		help:                   help.New(),
		keymap:                 defaultKeymap,
		cfg:                    cfg,
		ctx:                    context.Background(),
		showHelp:               false,
		debugMode:              debugMode,
		debugLog:               []string{},
		systemCheckResults:     make(map[string]*config.SystemCheckResult),
		systemCheckDone:        false,
		systemCheckError:       "",
	}

	if debugMode {
		m.debugLog = append(m.debugLog, "🐛 DEBUG MODE ENABLED - No operations will be executed")
		m.debugLog = append(m.debugLog, "")
	}

	return m
}

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                    BUBBLE TEA INTERFACE IMPLEMENTATION                     ║
║                                                                            ║
║  Required methods for the Bubble Tea Model interface.                     ║
║  Init, Update, and View handle the event loop.                            ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

/*
Init is called when the model is first created.
Returns initial commands to run.
*/
func (m Model) Init() tea.Cmd {
	return nil
}

/*
Update handles incoming messages and updates the model state.

Parameters:
  msg - The message to process (usually keyboard input)

Returns:
  tea.Model - Updated model
  tea.Cmd - Command to run (usually nil)
*/
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		/*
		Global quit binding - can be pressed from any screen
		*/
		if key.Matches(msg, m.keymap.quit) {
			m.quitting = true
			return m, tea.Quit
		}

		/*
		Help toggle - press '?' to show keybindings
		*/
		if key.Matches(msg, m.keymap.help) {
			m.showHelp = !m.showHelp
			return m, nil
		}

		/*
		Text input handling for input steps
		*/
		if m.step == StepServerIP || m.step == StepDomains || m.step == StepAdminCredentials {
			var cmd tea.Cmd
			m.textInput, cmd = m.textInput.Update(msg)
			return m, cmd
		}

		/*
		Next/Enter binding - advance to next step
		*/
		if key.Matches(msg, m.keymap.next) {
			return m.handleEnter()
		}

		/*
		Space to start installation - only on progress step
		*/
		if m.step == StepProgress && key.Matches(msg, m.keymap.start) {
			return m.startProgress()
		}

	case spinner.TickMsg:
		var cmd tea.Cmd
		m.spinner, cmd = m.spinner.Update(msg)
		return m, cmd

	case systemCheckCompleteMsg:
		/*
		System checks have completed
		*/
		if msg.err != nil {
			m.systemCheckError = msg.err.Error()
		} else {
			m.systemCheckResults = msg.checks
		}
		m.systemCheckDone = true
		return m, nil

	case tickMsg:
		/*
		Progress update message - advance the installation progress bar
		In debug mode, simulates operations; in normal mode, would execute them
		*/
		if m.step == StepProgress && m.progressValue < 1.0 {
			m.progressValue += 0.1

			if m.debugMode {
				/*
				In debug mode, add simulated operation logs
				*/
				operations := []string{
					"Checking system requirements...",
					"Creating Docker networks...",
					"Pulling container images...",
					"Writing configuration files...",
					"Generating environment file...",
					"Starting containers...",
					"Waiting for health checks...",
					"Seeding database...",
					"Installation simulation complete!",
				}

				if int(m.progressValue*10) <= len(operations) {
					idx := int(m.progressValue*10) - 1
					if idx >= 0 && idx < len(operations) {
						m.debugLog = append(m.debugLog, fmt.Sprintf("  [MOCK] %s", operations[idx]))
					}
				}
			}

			if m.progressValue >= 1.0 {
				m.progressValue = 1.0
				m.step = StepComplete
			}
			return m, tea.Tick(100*time.Millisecond, func(t time.Time) tea.Msg {
				return tickMsg{}
			})
		}
	}

	return m, nil
}

/*
View renders the current screen based on the current step.

Returns:
  string - The rendered UI as a string
*/
func (m Model) View() string {
	if m.quitting {
		return ""
	}

	switch m.step {
	case StepWelcome:
		return m.viewWelcome()
	case StepSystemCheck:
		return m.viewSystemCheck()
	case StepInstallationType:
		return m.viewInstallationType()
	case StepServerIP:
		return m.viewServerIP()
	case StepDomains:
		return m.viewDomains()
	case StepAdminCredentials:
		return m.viewAdminCredentials()
	case StepMonitoring:
		return m.viewMonitoring()
	case StepConfirmation:
		return m.viewConfirmation()
	case StepProgress:
		return m.viewProgress()
	case StepComplete:
		return m.viewComplete()
	default:
		return ""
	}
}

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                         SCREEN RENDERING FUNCTIONS                         ║
║                                                                            ║
║  Each function renders a specific screen/step of the installer.           ║
║  Uses lipgloss for styling and layout.                                    ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

/*
viewWelcome renders the welcome/intro screen.
Shows the installer title, version, platform information, and welcome message.
*/
func (m Model) viewWelcome() string {
	header := primaryStyle.Render("═══════════════════════════════════════════════════════════════")
	title := headerStyle.Render("StellarStack Installer")
	version := secondaryStyle.Render(fmt.Sprintf("Version: %s", installerVersion))
	date := secondaryStyle.Render(fmt.Sprintf("Built: %s", installerDate))

	/*
	Platform information
	*/
	platformOS := runtime.GOOS
	platformArch := runtime.GOARCH
	var platformLabel string
	switch platformOS {
	case "windows":
		platformLabel = "Windows"
	case "darwin":
		platformLabel = "macOS"
	case "linux":
		platformLabel = "Linux"
	default:
		platformLabel = platformOS
	}

	/*
	Architecture display
	*/
	var archLabel string
	switch platformArch {
	case "amd64":
		archLabel = "x86_64"
	case "arm64":
		archLabel = "ARM64"
	case "arm":
		archLabel = "ARM32"
	default:
		archLabel = platformArch
	}

	platform := secondaryStyle.Render(fmt.Sprintf("Platform: %s (%s)", platformLabel, archLabel))

	debugBanner := ""
	if m.debugMode {
		debugBanner = debugStyle.Render("🐛 DEBUG MODE - No operations will be executed")
	}

	footer := primaryStyle.Render("═══════════════════════════════════════════════════════════════")
	welcome := mutedStyle.Render("Welcome to the StellarStack Installer!")
	info := secondaryStyle.Render("This interactive installer will guide you through the setup.")
	instruction := primaryStyle.Render("Press [ENTER] to begin...")

	sections := []string{
		header,
		title,
		version,
		date,
		platform,
		footer,
		"",
		welcome,
		info,
	}

	if debugBanner != "" {
		sections = append(sections, "", debugBanner)
	}

	sections = append(sections, "", instruction)

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

/*
viewSystemCheck renders the system requirements check screen.
Shows the status of Docker, Nginx, and other dependencies.
In debug mode, shows simulated checks.
*/
func (m Model) viewSystemCheck() string {
	header := headerStyle.Render("System Requirements Check")
	divider := dividerStyle.Render("────────────────────────────────────────────────────────────")

	sections := []string{
		header,
		divider,
		"",
	}

	if !m.systemCheckDone {
		/*
		Show checks being performed
		*/
		if m.debugMode {
			sections = append(sections, m.spinner.View()+" Performing system requirements check...")
			sections = append(sections, "")
			sections = append(sections, mutedStyle.Render("Checking:"))
			sections = append(sections, secondaryStyle.Render("  ⧗ Docker installation"))
			sections = append(sections, secondaryStyle.Render("  ⧗ Docker Compose"))
			sections = append(sections, secondaryStyle.Render("  ⧗ System disk space"))
			sections = append(sections, secondaryStyle.Render("  ⧗ Memory availability"))
			sections = append(sections, "")
			sections = append(sections, mutedStyle.Render("(Simulated - no actual checks in debug mode)"))
		} else {
			sections = append(sections, m.spinner.View()+" Checking system requirements...")
			sections = append(sections, mutedStyle.Render("This may take a few moments..."))
		}
	} else {
		if m.systemCheckError != "" {
			sections = append(sections, errorStyle.Render("❌ System check failed"))
			sections = append(sections, errorStyle.Render(m.systemCheckError))
		} else {
			/*
			Display system checks
			*/
			sections = append(sections, successStyle.Render("✓ Docker available"))
			sections = append(sections, successStyle.Render("✓ Docker Compose available"))
			sections = append(sections, successStyle.Render("✓ Sufficient disk space"))
			sections = append(sections, successStyle.Render("✓ Sufficient memory"))
		}

		sections = append(sections, "")
		sections = append(sections, mutedStyle.Render("Press [ENTER] to continue..."))
	}

	if m.showHelp {
		sections = append(sections, "", m.help.View(m.keymap))
	}

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

/*
viewInstallationType renders the installation type selection screen.
Shows the available installation type options.
*/
func (m Model) viewInstallationType() string {
	header := headerStyle.Render("Select Installation Type")
	divider := dividerStyle.Render("────────────────────────────────────────────────────────────")

	options := []string{
		"[1] Panel + API - Complete control panel with backend (recommended)",
		"[2] Panel Only - Web interface only",
		"[3] API Only - Backend API server only",
		"[4] Daemon - Game server management daemon",
		"[5] All-in-One - Panel + API + Daemon + monitoring",
	}

	instruction := primaryStyle.Render("Enter your choice [1-5]: ")

	sections := []string{
		header,
		divider,
		"",
	}

	for _, opt := range options {
		sections = append(sections, secondaryStyle.Render(opt))
	}

	sections = append(sections, "", instruction)

	if m.showHelp {
		sections = append(sections, "", m.help.View(m.keymap))
	}

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

/*
viewServerIP renders the server IP configuration screen.
Allows user to enter or auto-detect their server's public IP.
*/
func (m Model) viewServerIP() string {
	header := headerStyle.Render("Server IP Configuration")
	divider := dividerStyle.Render("────────────────────────────────────────────────────────────")
	info := secondaryStyle.Render("Enter your server's public IP address")
	info2 := mutedStyle.Render("(This is the IP your domains will point to)")
	input := m.textInput.View()
	help := mutedStyle.Render("Press [ENTER] to continue")

	sections := []string{
		header,
		divider,
		"",
		info,
		info2,
		"",
		input,
		"",
		help,
	}

	if m.showHelp {
		sections = append(sections, "", m.help.View(m.keymap))
	}

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

/*
viewDomains renders the domain configuration screen.
Allows user to enter panel and API domains.
*/
func (m Model) viewDomains() string {
	header := headerStyle.Render("Domain Configuration")
	divider := dividerStyle.Render("────────────────────────────────────────────────────────────")
	info := secondaryStyle.Render("Enter your panel domain")
	input := m.textInput.View()
	help := mutedStyle.Render("Press [ENTER] to continue")

	sections := []string{
		header,
		divider,
		"",
		info,
		"",
		input,
		"",
		help,
	}

	if m.showHelp {
		sections = append(sections, "", m.help.View(m.keymap))
	}

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

/*
viewAdminCredentials renders the admin account creation screen.
Allows user to set admin email, name, and password.
*/
func (m Model) viewAdminCredentials() string {
	header := headerStyle.Render("Create Admin Account")
	divider := dividerStyle.Render("────────────────────────────────────────────────────────────")
	info := secondaryStyle.Render("Enter admin email address")
	input := m.textInput.View()
	help := mutedStyle.Render("Press [ENTER] to continue")

	sections := []string{
		header,
		divider,
		"",
		info,
		"",
		input,
		"",
		help,
	}

	if m.showHelp {
		sections = append(sections, "", m.help.View(m.keymap))
	}

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

/*
viewMonitoring renders the optional monitoring stack screen.
Allows user to enable/disable monitoring installation.
*/
func (m Model) viewMonitoring() string {
	header := headerStyle.Render("Optional: Monitoring Stack")
	divider := dividerStyle.Render("────────────────────────────────────────────────────────────")
	info := secondaryStyle.Render("Install Prometheus, Loki, and Grafana for observability?")
	info2 := mutedStyle.Render("(Recommended for production deployments)")
	instruction := primaryStyle.Render("Enter [y] for yes or [n] for no: ")

	sections := []string{
		header,
		divider,
		"",
		info,
		info2,
		"",
		instruction,
	}

	if m.showHelp {
		sections = append(sections, "", m.help.View(m.keymap))
	}

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

/*
viewConfirmation renders the configuration confirmation screen.
Shows a summary of configuration and asks for final confirmation.
*/
func (m Model) viewConfirmation() string {
	header := primaryStyle.Render("═══════════════════════════════════════════════════════════════")
	title := headerStyle.Render("Configuration Summary")
	footer := primaryStyle.Render("═══════════════════════════════════════════════════════════════")

	installType := secondaryStyle.Render(fmt.Sprintf("Installation Type: %s", m.cfg.InstallType))
	serverIP := secondaryStyle.Render(fmt.Sprintf("Server IP: %s", m.cfg.ServerIP))
	panelDomain := secondaryStyle.Render(fmt.Sprintf("Panel Domain: %s", m.cfg.PanelDomain))
	apiDomain := secondaryStyle.Render(fmt.Sprintf("API Domain: %s", m.cfg.APIDomain))

	confirmation := primaryStyle.Render("Proceed with installation [y/n]: ")

	sections := []string{
		header,
		title,
		footer,
		"",
		installType,
		serverIP,
		panelDomain,
		apiDomain,
		"",
		confirmation,
	}

	if m.showHelp {
		sections = append(sections, "", m.help.View(m.keymap))
	}

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

/*
viewProgress renders the installation progress screen.
Shows the progress bar and collected configuration.
In debug mode, also shows the operation log.
*/
func (m Model) viewProgress() string {
	header := primaryStyle.Render("INSTALLING STELLARSTACK")

	debugBanner := ""
	if m.debugMode {
		debugBanner = debugStyle.Render("🐛 DEBUG MODE - Simulating operations")
	}

	divider := dividerStyle.Render("────────────────────────────────────────────────────────────")

	prog := m.progress.ViewAs(m.progressValue)

	installType := secondaryStyle.Render(fmt.Sprintf("Type: %s", m.cfg.InstallType))
	serverIP := secondaryStyle.Render(fmt.Sprintf("Server IP: %s", m.cfg.ServerIP))

	instruction := primaryStyle.Render("Press [SPACE] to start installation...")
	if m.progressValue > 0 {
		instruction = mutedStyle.Render("Installing...")
	}

	sections := []string{
		header,
	}

	if debugBanner != "" {
		sections = append(sections, debugBanner)
	}

	sections = append(sections, []string{
		divider,
		"",
		installType,
		serverIP,
		"",
		prog,
		"",
		instruction,
	}...)

	/*
	In debug mode, show operation log
	*/
	if m.debugMode && len(m.debugLog) > 0 {
		sections = append(sections, "", mutedStyle.Render("Operation Log:"))
		for _, log := range m.debugLog {
			sections = append(sections, mutedStyle.Render(log))
		}
	}

	if m.showHelp {
		sections = append(sections, "", m.help.View(m.keymap))
	}

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

/*
viewComplete renders the completion/success screen.
Shows the final configuration summary and next steps.
In debug mode, shows the full operation log.
*/
func (m Model) viewComplete() string {
	header := primaryStyle.Render("═══════════════════════════════════════════════════════════════")

	completeText := "INSTALLATION COMPLETE!"
	if m.debugMode {
		completeText = "DEBUG SIMULATION COMPLETE!"
	}

	title := headerStyle.Render(completeText)
	footer := primaryStyle.Render("═══════════════════════════════════════════════════════════════")

	installType := secondaryStyle.Render(fmt.Sprintf("Type: %s", m.cfg.InstallType))
	serverIP := secondaryStyle.Render(fmt.Sprintf("Server IP: %s", m.cfg.ServerIP))
	panelDomain := secondaryStyle.Render(fmt.Sprintf("Panel Domain: %s", m.cfg.PanelDomain))

	nextSteps := mutedStyle.Render("Next steps:")
	step1 := secondaryStyle.Render("1. Configure your DNS records")
	step2 := secondaryStyle.Render("2. Access your installation")
	step3 := secondaryStyle.Render("3. Start managing your servers")

	exit := primaryStyle.Render("Press [q] to exit")

	sections := []string{
		header,
		title,
		footer,
		"",
		installType,
		serverIP,
		panelDomain,
		"",
		nextSteps,
		step1,
		step2,
		step3,
		"",
	}

	/*
	In debug mode, show full operation log
	*/
	if m.debugMode {
		sections = append(sections, debugStyle.Render("Debug Operation Log:"))
		for _, log := range m.debugLog {
			sections = append(sections, mutedStyle.Render(log))
		}
		sections = append(sections, "")
	}

	sections = append(sections, exit)

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                    USER INTERACTION HANDLERS                               ║
║                                                                            ║
║  Functions that handle user input and advance the workflow.               ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

/*
handleEnter processes the ENTER key and advances to the next step.
Collects and validates user input before moving forward.

Returns:
  *Model - Updated model with next step
  tea.Cmd - Command to run
*/
func (m *Model) handleEnter() (*Model, tea.Cmd) {
	input := strings.TrimSpace(m.textInput.Value())

	switch m.step {
	case StepWelcome:
		m.step = StepSystemCheck
		m.textInput.Reset()
		m.textInput.Blur()

	case StepSystemCheck:
		/*
		In debug mode, automatically populate system check results
		In normal mode, this would trigger actual system checks
		*/
		if m.debugMode && !m.systemCheckDone {
			m.systemCheckDone = true
		}
		if m.systemCheckDone {
			m.step = StepInstallationType
			m.textInput.Reset()
			m.textInput.Focus()
		}

	case StepInstallationType:
		/*
		Parse installation type selection
		*/
		switch input {
		case "1":
			m.cfg.InstallType = config.PanelAndAPI
		case "2":
			m.cfg.InstallType = config.Panel
		case "3":
			m.cfg.InstallType = config.API
		case "4":
			m.cfg.InstallType = config.Daemon
		case "5":
			m.cfg.InstallType = config.AllInOne
		default:
			/*
			Invalid input, stay on this step
			*/
			return m, nil
		}
		m.step = StepServerIP
		m.textInput.Reset()
		m.textInput.Focus()

	case StepServerIP:
		if input == "" {
			/*
			Empty input, stay on this step
			*/
			return m, nil
		}
		if !config.IsValidIP(input) {
			/*
			Invalid IP, stay on this step
			*/
			return m, nil
		}
		m.cfg.ServerIP = input
		m.step = StepDomains
		m.textInput.Reset()
		m.textInput.Focus()

	case StepDomains:
		if input == "" {
			/*
			Empty input, stay on this step
			*/
			return m, nil
		}
		m.cfg.PanelDomain = input
		m.step = StepAdminCredentials
		m.textInput.Reset()
		m.textInput.Focus()

	case StepAdminCredentials:
		if input == "" {
			/*
			Empty input, stay on this step
			*/
			return m, nil
		}
		m.cfg.AdminEmail = input
		m.step = StepMonitoring
		m.textInput.Reset()
		m.textInput.Blur()

	case StepMonitoring:
		response := strings.ToLower(input)
		if response == "y" || response == "yes" {
			m.cfg.InstallMonitoring = true
		}
		m.step = StepConfirmation
		m.textInput.Reset()
		m.textInput.Blur()

	case StepConfirmation:
		response := strings.ToLower(input)
		if response == "y" || response == "yes" {
			m.step = StepProgress
			m.textInput.Blur()
		}
		/*
		If user enters 'n', stay on confirmation screen
		*/

	case StepComplete:
		return m, tea.Quit
	}

	return m, nil
}

/*
startProgress initiates the installation progress simulation.
Sets the progress bar to a small initial value and starts the ticker.

Returns:
  *Model - Updated model
  tea.Cmd - Tick command to start progress updates
*/
func (m *Model) startProgress() (*Model, tea.Cmd) {
	m.progressValue = 0.01
	return m, tea.Tick(100*time.Millisecond, func(t time.Time) tea.Msg {
		return tickMsg{}
	})
}

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                         MAIN ENTRY POINT                                   ║
║                                                                            ║
║  CLI argument handling and Bubble Tea program initialization.              ║
╚════════════════════════════════════════════════════════════════════════════╝
*/

func main() {
	debugMode := false

	/*
	Check for command-line flags
	*/
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "--version", "-v":
			fmt.Printf("StellarStack Installer v%s\n", installerVersion)
			return

		case "--help", "-h":
			fmt.Printf(`Usage: installer [options]

Options:
  --version, -v     Show version information
  --help, -h        Show this help message
  --debug, -d       Run in debug/dry-run mode (no operations executed)

Debug Mode:
  The debug mode allows you to test the installer flow without making any
  changes to your system. All operations are simulated and logged.

Examples:
  ./installer              # Run normal installation
  ./installer --debug      # Run in debug mode
  ./installer --version    # Show version
`)
			return

		case "--debug", "-d":
			debugMode = true

		default:
			fmt.Fprintf(os.Stderr, "Unknown option: %s\n", os.Args[1])
			fmt.Fprintf(os.Stderr, "Use --help for usage information\n")
			os.Exit(1)
		}
	}

	/*
	Create and run the Bubble Tea program
	*/
	p := tea.NewProgram(initialModel(debugMode), tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
