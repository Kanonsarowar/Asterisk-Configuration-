package com.iprn.accessanalyzer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.Divider
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.rememberDrawerState
import androidx.compose.ui.text.input.KeyboardOptions
import kotlinx.coroutines.launch
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                AccessAnalyzerApp()
            }
        }
    }
}

enum class Screen(val label: String) {
    Home("Home"),
    TestNumbers("Test numbers"),
    Tests("Tests"),
    Settings("Settings")
}

data class TestNumber(
    val id: Int,
    val supplier: String,
    val operator: String,
    val number: String,
    val country: String,
    val isSelected: Boolean = false
)

data class TestRun(
    val name: String,
    val totalNumbers: Int,
    val calledNumbers: Int,
    val status: String,
    val createdAt: String
)

data class UserSettings(
    val callerId: String,
    val callingPrefix: String,
    val delaySeconds: Int,
    val offHookDurationSeconds: Int
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AccessAnalyzerApp() {
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    var currentScreen by remember { mutableStateOf(Screen.Home) }
    var showImportDialog by remember { mutableStateOf(false) }
    var showSettingsEditor by remember { mutableStateOf(false) }

    var numbers by remember { mutableStateOf(sampleNumbers()) }
    var tests by remember { mutableStateOf(sampleTests()) }
    var settings by remember {
        mutableStateOf(
            UserSettings(
                callerId = "966500000000",
                callingPrefix = "+",
                delaySeconds = 10,
                offHookDurationSeconds = 10
            )
        )
    }

    val selectedCount = numbers.count { it.isSelected }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.primary)
                        .padding(20.dp)
                ) {
                    Column {
                        Text("AT", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "Access Tracker",
                            color = Color.White,
                            style = MaterialTheme.typography.titleMedium
                        )
                    }
                }

                DrawerDestination(
                    selected = currentScreen == Screen.Home,
                    label = "Home",
                    icon = { Icon(Icons.Default.Home, contentDescription = null) },
                    onClick = {
                        currentScreen = Screen.Home
                        scope.launch { drawerState.close() }
                    }
                )
                DrawerDestination(
                    selected = currentScreen == Screen.TestNumbers,
                    label = "Test numbers",
                    icon = { Icon(Icons.Default.List, contentDescription = null) },
                    onClick = {
                        currentScreen = Screen.TestNumbers
                        scope.launch { drawerState.close() }
                    }
                )
                DrawerDestination(
                    selected = currentScreen == Screen.Tests,
                    label = "Tests",
                    icon = { Icon(Icons.Default.CheckCircle, contentDescription = null) },
                    onClick = {
                        currentScreen = Screen.Tests
                        scope.launch { drawerState.close() }
                    }
                )
                DrawerDestination(
                    selected = currentScreen == Screen.Settings,
                    label = "Settings",
                    icon = { Icon(Icons.Default.Settings, contentDescription = null) },
                    onClick = {
                        currentScreen = Screen.Settings
                        scope.launch { drawerState.close() }
                    }
                )

                Divider(Modifier.padding(vertical = 8.dp))
                Text(
                    "Quick actions",
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                DrawerDestination(
                    selected = false,
                    label = "Sync test numbers",
                    icon = { Icon(Icons.Default.Sync, contentDescription = null) },
                    onClick = {
                        showImportDialog = true
                        scope.launch { drawerState.close() }
                    }
                )
            }
        }
    ) {
        Scaffold(
            topBar = {
                CenterAlignedTopAppBar(
                    title = { Text(currentScreen.label) },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(Icons.Default.Menu, contentDescription = "Menu")
                        }
                    },
                    colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        titleContentColor = Color.White,
                        navigationIconContentColor = Color.White
                    )
                )
            },
            bottomBar = {
                NavigationBar {
                    BottomDestination(
                        current = currentScreen,
                        target = Screen.Home,
                        icon = { Icon(Icons.Default.Home, contentDescription = null) },
                        onClick = { currentScreen = Screen.Home }
                    )
                    BottomDestination(
                        current = currentScreen,
                        target = Screen.TestNumbers,
                        icon = { Icon(Icons.Default.List, contentDescription = null) },
                        onClick = { currentScreen = Screen.TestNumbers }
                    )
                    BottomDestination(
                        current = currentScreen,
                        target = Screen.Tests,
                        icon = { Icon(Icons.Default.CheckCircle, contentDescription = null) },
                        onClick = { currentScreen = Screen.Tests }
                    )
                    BottomDestination(
                        current = currentScreen,
                        target = Screen.Settings,
                        icon = { Icon(Icons.Default.Settings, contentDescription = null) },
                        onClick = { currentScreen = Screen.Settings }
                    )
                }
            },
            floatingActionButton = {
                when (currentScreen) {
                    Screen.Tests -> {
                        FloatingActionButton(
                            onClick = {
                                if (selectedCount > 0) {
                                    tests = listOf(
                                        TestRun(
                                            name = "New run",
                                            totalNumbers = selectedCount,
                                            calledNumbers = 0,
                                            status = "running",
                                            createdAt = LocalDateTime.now()
                                                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
                                        )
                                    ) + tests
                                    currentScreen = Screen.Tests
                                }
                            }
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = "Start test")
                        }
                    }

                    Screen.Settings -> {
                        FloatingActionButton(onClick = { showSettingsEditor = true }) {
                            Icon(Icons.Default.Edit, contentDescription = "Edit settings")
                        }
                    }

                    else -> Unit
                }
            }
        ) { innerPadding ->
            when (currentScreen) {
                Screen.Home -> HomeScreen(innerPadding)
                Screen.TestNumbers -> TestNumbersScreen(
                    innerPadding = innerPadding,
                    numbers = numbers,
                    onToggleNumber = { id ->
                        numbers = numbers.map {
                            if (it.id == id) it.copy(isSelected = !it.isSelected) else it
                        }
                    },
                    onSelectAllVisible = { visibleIds ->
                        numbers = numbers.map {
                            if (it.id in visibleIds) it.copy(isSelected = true) else it
                        }
                    },
                    onClearAllVisible = { visibleIds ->
                        numbers = numbers.map {
                            if (it.id in visibleIds) it.copy(isSelected = false) else it
                        }
                    },
                    selectedCount = selectedCount
                )

                Screen.Tests -> TestsScreen(innerPadding, tests)
                Screen.Settings -> SettingsScreen(innerPadding, settings)
            }
        }
    }

    if (showImportDialog) {
        ImportNumbersDialog(
            onDismiss = { showImportDialog = false },
            onImport = { rawInput ->
                val imported = parseNumbers(rawInput, numbers.maxOfOrNull { it.id } ?: 0)
                if (imported.isNotEmpty()) {
                    numbers = numbers + imported
                }
                showImportDialog = false
            }
        )
    }

    if (showSettingsEditor) {
        EditSettingsDialog(
            current = settings,
            onDismiss = { showSettingsEditor = false },
            onSave = {
                settings = it
                showSettingsEditor = false
            }
        )
    }
}

@Composable
private fun DrawerDestination(
    selected: Boolean,
    label: String,
    icon: @Composable () -> Unit,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        color = if (selected) MaterialTheme.colorScheme.primary.copy(alpha = 0.12f) else Color.Transparent
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            icon()
            Spacer(Modifier.width(16.dp))
            Text(label, style = MaterialTheme.typography.bodyLarge)
        }
    }
}

@Composable
private fun BottomDestination(
    current: Screen,
    target: Screen,
    icon: @Composable () -> Unit,
    onClick: () -> Unit
) {
    NavigationBarItem(
        selected = current == target,
        onClick = onClick,
        icon = icon,
        label = { Text(target.label, maxLines = 1, overflow = TextOverflow.Ellipsis) }
    )
}

@Composable
private fun HomeScreen(innerPadding: PaddingValues) {
    val paragraphStyle = MaterialTheme.typography.bodyLarge
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(innerPadding)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            "Welcome to IPRN Access Analyzer",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )
        Text(
            "Use this tool to verify caller access to Saudi operators (STC, Mobily, Zain) with daily supplier numbers.",
            style = paragraphStyle
        )
        Text(
            "1) Sync supplier test numbers.\n2) Select numbers from the Test numbers tab.\n3) Start test runs from the Tests tab.",
            style = paragraphStyle
        )
        Text(
            "Personal-use mode: all data is stored locally on your device.",
            style = paragraphStyle,
            color = MaterialTheme.colorScheme.primary
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TestNumbersScreen(
    innerPadding: PaddingValues,
    numbers: List<TestNumber>,
    onToggleNumber: (Int) -> Unit,
    onSelectAllVisible: (Set<Int>) -> Unit,
    onClearAllVisible: (Set<Int>) -> Unit,
    selectedCount: Int
) {
    var query by remember { mutableStateOf("") }
    var supplierFilter by remember { mutableStateOf("All suppliers") }
    var menuExpanded by remember { mutableStateOf(false) }
    val supplierOptions = listOf("All suppliers", "STC", "Mobily", "Zain")

    val filtered = numbers.filter { entry ->
        val supplierMatches = supplierFilter == "All suppliers" || entry.supplier.equals(supplierFilter, true)
        val queryMatches = query.isBlank() ||
            entry.number.contains(query, ignoreCase = true) ||
            entry.operator.contains(query, ignoreCase = true) ||
            entry.country.contains(query, ignoreCase = true)
        supplierMatches && queryMatches
    }
    val visibleIds = filtered.map { it.id }.toSet()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(innerPadding)
            .padding(horizontal = 12.dp)
    ) {
        Spacer(Modifier.height(8.dp))
        Text(
            "Number group",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.primary
        )
        Box {
            OutlinedTextField(
                value = supplierFilter,
                onValueChange = {},
                modifier = Modifier.fillMaxWidth(),
                readOnly = true,
                label = { Text("Supplier") },
                trailingIcon = {
                    TextButton(onClick = { menuExpanded = true }) {
                        Text("Change")
                    }
                }
            )
            DropdownMenu(
                expanded = menuExpanded,
                onDismissRequest = { menuExpanded = false }
            ) {
                supplierOptions.forEach { option ->
                    DropdownMenuItem(
                        text = { Text(option) },
                        onClick = {
                            supplierFilter = option
                            menuExpanded = false
                        }
                    )
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Termination or number") }
        )
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = { onSelectAllVisible(visibleIds) },
                modifier = Modifier.weight(1f)
            ) {
                Text("SELECT ALL")
            }
            OutlinedButton(
                onClick = { onClearAllVisible(visibleIds) },
                modifier = Modifier.weight(1f)
            ) {
                Text("DESELECT ALL")
            }
        }
        Spacer(Modifier.height(6.dp))
        Text(
            "Showing ${filtered.size} items · Selected $selectedCount",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(8.dp))
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            items(filtered, key = { it.id }) { item ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onToggleNumber(item.id) }
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        androidx.compose.material3.Checkbox(
                            checked = item.isSelected,
                            onCheckedChange = { onToggleNumber(item.id) }
                        )
                        Spacer(Modifier.width(10.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(item.operator, fontWeight = FontWeight.Bold)
                            Text(item.number, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(
                                "${item.country} · ${item.supplier}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TestsScreen(innerPadding: PaddingValues, tests: List<TestRun>) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(innerPadding)
            .padding(horizontal = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item { Spacer(Modifier.height(8.dp)) }
        items(tests) { test ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            test.name,
                            style = MaterialTheme.typography.titleMedium,
                            modifier = Modifier.weight(1f)
                        )
                        StatusBadge(status = test.status)
                    }
                    Text(
                        "${test.totalNumbers} numbers, ${test.calledNumbers} called",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Text(
                        "Created ${test.createdAt}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Divider(Modifier.padding(vertical = 4.dp))
                    Text(
                        "${test.calledNumbers} out of ${test.totalNumbers} called numbers reached",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }
        item { Spacer(Modifier.height(80.dp)) }
    }
}

@Composable
private fun SettingsScreen(innerPadding: PaddingValues, settings: UserSettings) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(innerPadding),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(12.dp)
    ) {
        item {
            SettingsSection(
                title = "Caller ID",
                lines = listOf(
                    "Phone number",
                    settings.callerId,
                    "",
                    "Caller ID preferences",
                    "Ensure your Caller ID is not hidden in call settings."
                )
            )
        }
        item {
            SettingsSection(
                title = "Call settings",
                lines = listOf(
                    "Calling prefix",
                    settings.callingPrefix
                )
            )
        }
        item {
            SettingsSection(
                title = "Default test values",
                lines = listOf(
                    "Delay between calls in seconds",
                    settings.delaySeconds.toString(),
                    "",
                    "Maximum off-hook duration in seconds",
                    settings.offHookDurationSeconds.toString()
                )
            )
        }
        item {
            SettingsSection(
                title = "Synchronization",
                lines = listOf("Synchronize test numbers from daily supplier list in drawer action.")
            )
        }
    }
}

@Composable
private fun SettingsSection(title: String, lines: List<String>) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
            lines.forEach { line ->
                if (line.isEmpty()) {
                    Spacer(Modifier.height(2.dp))
                } else {
                    Text(line, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}

@Composable
private fun StatusBadge(status: String) {
    val normalized = status.lowercase()
    val background = if (normalized == "running") Color(0xFFDCEBFF) else Color(0xFFECECEC)
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = background
    ) {
        Text(
            status,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelMedium
        )
    }
}

@Composable
private fun ImportNumbersDialog(
    onDismiss: () -> Unit,
    onImport: (String) -> Unit
) {
    var rawInput by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Sync test numbers") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "Paste daily supplier rows (CSV): supplier,operator,number,country",
                    style = MaterialTheme.typography.bodySmall
                )
                OutlinedTextField(
                    value = rawInput,
                    onValueChange = { rawInput = it },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp),
                    placeholder = { Text("STC,STC,966512345678,Saudi Arabia") }
                )
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
        confirmButton = {
            Button(onClick = { onImport(rawInput) }) { Text("Import") }
        }
    )
}

@Composable
private fun EditSettingsDialog(
    current: UserSettings,
    onDismiss: () -> Unit,
    onSave: (UserSettings) -> Unit
) {
    var callerId by remember { mutableStateOf(current.callerId) }
    var prefix by remember { mutableStateOf(current.callingPrefix) }
    var delay by remember { mutableStateOf(current.delaySeconds.toString()) }
    var offHook by remember { mutableStateOf(current.offHookDurationSeconds.toString()) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Edit settings") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = callerId,
                    onValueChange = { callerId = it },
                    label = { Text("Caller ID") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = prefix,
                    onValueChange = { prefix = it },
                    label = { Text("Calling prefix") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = delay,
                    onValueChange = { delay = it.filter(Char::isDigit) },
                    label = { Text("Delay (seconds)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = offHook,
                    onValueChange = { offHook = it.filter(Char::isDigit) },
                    label = { Text("Off-hook max duration (seconds)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSave(
                        UserSettings(
                            callerId = callerId.trim(),
                            callingPrefix = prefix.trim(),
                            delaySeconds = delay.toIntOrNull() ?: current.delaySeconds,
                            offHookDurationSeconds = offHook.toIntOrNull() ?: current.offHookDurationSeconds
                        )
                    )
                }
            ) {
                Text("Save")
            }
        }
    )
}

private fun parseNumbers(rawInput: String, currentMaxId: Int): List<TestNumber> {
    var nextId = currentMaxId + 1
    return rawInput
        .lineSequence()
        .map { it.trim() }
        .filter { it.isNotBlank() }
        .mapNotNull { line ->
            val cols = line.split(",").map { it.trim() }
            if (cols.size < 3) {
                return@mapNotNull null
            }
            val supplier = cols[0].ifBlank { "Unknown" }
            val operator = cols.getOrElse(1) { "Unknown" }.ifBlank { "Unknown" }
            val number = cols.getOrElse(2) { "" }.filter { it.isDigit() || it == '+' }
            val country = cols.getOrElse(3) { "Saudi Arabia" }.ifBlank { "Saudi Arabia" }
            if (number.isBlank()) {
                return@mapNotNull null
            }
            TestNumber(
                id = nextId++,
                supplier = supplier,
                operator = operator,
                number = number,
                country = country
            )
        }.toList()
}

private fun sampleNumbers(): List<TestNumber> {
    val stc = listOf("966501111111", "966501111112", "966501111113", "966501111114", "966501111115")
    val mobily = listOf("966541111111", "966541111112", "966541111113", "966541111114", "966541111115")
    val zain = listOf("966591111111", "966591111112", "966591111113", "966591111114", "966591111115")
    val allRows = mutableListOf<TestNumber>()
    var id = 1
    stc.forEach {
        allRows += TestNumber(id++, "STC", "STC", it, "Saudi Arabia")
    }
    mobily.forEach {
        allRows += TestNumber(id++, "Mobily", "Mobily", it, "Saudi Arabia")
    }
    zain.forEach {
        allRows += TestNumber(id++, "Zain", "Zain", it, "Saudi Arabia")
    }
    return allRows
}

private fun sampleTests(): List<TestRun> = listOf(
    TestRun(
        name = "Saudi Daily Run",
        totalNumbers = 15,
        calledNumbers = 0,
        status = "running",
        createdAt = "2026-03-19 08:32:26"
    ),
    TestRun(
        name = "Mobily Archive",
        totalNumbers = 10,
        calledNumbers = 10,
        status = "archived",
        createdAt = "2026-03-14 07:45:52"
    ),
    TestRun(
        name = "Zain Archive",
        totalNumbers = 10,
        calledNumbers = 10,
        status = "archived",
        createdAt = "2026-03-13 07:41:47"
    )
)
