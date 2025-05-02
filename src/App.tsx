import { useEffect, useRef, useState } from 'react';
import { Layout, Model, TabNode, IJsonModel, TabSetNode, BorderNode, ITabSetRenderValues } from 'flexlayout-react';
import Editor from '@monaco-editor/react';
import { editor as monacotypes } from 'monaco-editor';
import './rounded_dark.css';
import './App.css';
import './monaco.css';

const json: IJsonModel = {
    global: {
        "tabEnablePopout": true,
        "splitterEnableHandle": true,
        "tabSetMinWidth": 130,
        "tabSetMinHeight": 100,
        "borderMinSize": 100,
        "tabSetEnableTabScrollbar": true,
        "borderEnableTabScrollbar": true,
        "tabEnableRename": false,
        "borderEnableAutoHide": true,
    },
    borders: [
        {
            "type": "border",
            "location": "bottom",
            "children": [
                {
                    "type": "tab",
                    "name": "Debug",
                    "component": "debug-terminal",
                    "enableClose": false,
                },
            ]
        },
        {
            "type": "border",
            "location": "left",
            "children": [
            ]
        },
        {
            "type": "border",
            "location": "right",
            "children": [
            ]
        },

    ],
    layout: {
        type: "row",
        weight: 100,
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    {
                        type: "tab",
                        name: "Template",
                        component: "monaco-template",
                        "enableClose": false,
                    }
                ]
            },
            {
                type: "tabset",
                weight: 50,
                children: [
                    {
                        type: "tab",
                        name: "Values",
                        component: "monaco-values",
                        "enableClose": false,
                    }
                ]
            },
            {
                type: "tabset",
                weight: 50,
                children: [
                    {
                        type: "tab",
                        name: "Output",
                        component: "monaco-output",
                        "enableClose": false,
                    }
                ]
            }
        ]
    }
};

const model = Model.fromJson(json);

/* CODE PORTED FROM Vanilla JS START */
// These functions will be available after scripts are loaded
declare global {
    interface Window {
        LZString: any;
        Go: any;
        loadGetYaml: () => Promise<any>;
        GetYaml: (templateYaml: string, valuesYaml: string) => string;
    }
}

// Default template and values
const defaultTemplateYaml = "---\nexample: {{- .Values.items | toYaml | nindent 2 }}\n";
const defaultValuesYaml = '---\nitems: ["first", "second"]\n';
const defaultOutput = "---\nexample: \n  - first\n  - second\n";

// Parse template error to get line and character numbers
function parseTemplateError(err: string) {
    const match = err.match(/template: .*:(\d+): (.*)/);
    if (match) {
        return {
            lineNum: parseInt(match[1]) - 1,
            message: match[2]
        };
    }
    return null;
}

// Error handling utility
function showError(message: string) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.prepend(errorDiv);
}

// Load dependencies sequentially

// Wait for global object to be available
function waitForGlobal(name: any, timeout = 5000) {
    return new Promise<any>((resolve, reject) => {
        const start = Date.now();
        const interval = setInterval(() => {
            if (window[name]) {
                clearInterval(interval);
                resolve(window[name]);
            } else if (Date.now() - start > timeout) {
                clearInterval(interval);
                reject(new Error(`Timeout waiting for ${name}`));
            }
        }, 100);
    });
}

// Initialize the environment by loading all required scripts
async function initializeEnvironment() {
    try {
        // Wait for LZString to be available
        await waitForGlobal('LZString');
        
        return true;
    } catch (error) {
        console.error('Failed to initialize environment:', error);
        throw error;
    }
}

// Helper functions for URL hash management
function compressToEncodedURIComponent(value: string) {
    return window.LZString.compressToEncodedURIComponent(value);
}

function decompressFromEncodedURIComponent(value: string) {
    return window.LZString.decompressFromEncodedURIComponent(value);
}

function updateHash(templateValue: string, valuesValue: string) {
    const hashParams = new URLSearchParams();
    hashParams.append("t", compressToEncodedURIComponent(templateValue));
    hashParams.append("v", compressToEncodedURIComponent(valuesValue));
    const hash = hashParams.toString();
    window.history.replaceState(null, "", `#${hash}`);
}

function readHash() {
    const hashContent = window.location.hash.slice(1);
    if (hashContent === "") {
        return null;
    }
    const params = new URLSearchParams(hashContent);
    const templateValue = decompressFromEncodedURIComponent(params.get("t") || "");
    const valuesValue = decompressFromEncodedURIComponent(params.get("v") || "");
    return { templateValue, valuesValue };
}

/* CODE PORTED FROM Vanilla JS END */


function App() {
    const editorRef = useRef<any>(null);
    const valuesRef = useRef<any>(null);
    const outputRef = useRef<any>(null);
    const monacoRef = useRef<any>(null);
    const [debugMessage, setDebugMessage] = useState<string>(''); // Add state for debug message
    const [initialValues, setInitialValues] = useState({
        template: defaultTemplateYaml,
        values: defaultValuesYaml,
        output: defaultOutput
    });

    // Track editor mounting status
    const [editorsReady, setEditorsReady] = useState({
        template: false,
        values: false,
        output: false,
        monaco: false
    });

    // Initialize the environment and setup editors
    useEffect(() => {
        // Initialize the environment
        initializeEnvironment().then(() => {
            // Read values from hash if available
            const fromHash = readHash();
            if (fromHash) {
                setInitialValues({
                    template: fromHash.templateValue,
                    values: fromHash.valuesValue,
                    output: ""
                });
            }
        }).catch(error => {
            showError(`Critical error during initialization: ${error.message}`);
            console.error('Critical error:', error);
        });
    }, []);

    // Setup WASM integration once all editors are ready
    useEffect(() => {
        // Check if all editors are mounted
        if (!editorsReady.template || !editorsReady.values || !editorsReady.output || !editorsReady.monaco) {
            return; // Wait until all editors are ready
        }

        const editor = editorRef.current;
        const values = valuesRef.current;
        const output = outputRef.current;
        const monaco = monacoRef.current;

        if (!editor || !values || !output || !monaco) {
            return; // Safety check
        }

        // Register a custom code lens provider
        monaco.languages.registerCodeLensProvider('yaml', {
            provideCodeLenses: function (model: any, _token: any) {
                const markers = monaco.editor.getModelMarkers({ resource: model.uri });
                return {
                    lenses: markers.map((marker: { startLineNumber: any; startColumn: any; endLineNumber: any; endColumn: any; message: any; }) => ({
                        range: {
                            startLineNumber: marker.startLineNumber,
                            startColumn: marker.startColumn,
                            endLineNumber: marker.endLineNumber,
                            endColumn: marker.endColumn
                        },
                        id: `error-${marker.startLineNumber}`,
                        command: {
                            id: 'showError',
                            title: `⚠️ ${marker.message}`
                        }
                    })),
                    dispose: () => { }
                };
            },
            resolveCodeLens: function (_model: any, codeLens: any, _token: any) {
                return codeLens;
            }
        });
        
        // Register command handler for error markers
        monaco.editor.registerCommand('showError', (_accessor: any, ...args: any[] ) => {
            const editor = editorRef.current;
            if (!editor) return;
            
            const [marker] = args;
            if (marker) {
                editor.revealLineInCenter(marker.startLineNumber);
                editor.setPosition({
                    lineNumber: marker.startLineNumber,
                    column: marker.startColumn
                });
                editor.focus();
                
                // Show peek view for the error
                const range = {
                    startLineNumber: marker.startLineNumber,
                    startColumn: marker.startColumn,
                    endLineNumber: marker.endLineNumber,
                    endColumn: marker.endColumn
                };
                
                // Create error decorations
                const decorations = [{
                    range,
                    options: {
                        isWholeLine: true,
                        className: 'errorDecoration',
                        glyphMarginClassName: 'errorGlyphMargin',
                        hoverMessage: { value: marker.message }
                    }
                }];
                
                // Add decorations and show peek view
                const decorationIds = editor.deltaDecorations([], decorations);
                setTimeout(() => {
                    editor.removeDecorations(decorationIds);
                }, 3000);
                
                editor.getContribution('editor.contrib.peekViewWidget').show(range, [{
                    range,
                    message: marker.message
                }]);
            }
        });

        // Load WASM functionality
        window.loadGetYaml().then((getYaml) => {
            const onChange = () => {
                try {
                    const templateValue = editor.getValue();
                    const valuesValue = values.getValue();

                    const { yaml, err, warning } = getYaml(
                        templateValue,
                        valuesValue
                    );

                    // Update debug terminal state
                    if (err) {
                        setDebugMessage(err);
                    } else if (warning) {
                        setDebugMessage(warning);
                    } else {
                        setDebugMessage(''); // Clear message if no error/warning
                    }

                    // Clear existing markers
                    // Clear all markers first
                    monaco.editor.setModelMarkers(editor.getModel(), 'template-errors', []);
                    
                    if (err) {
                        const templateError = parseTemplateError(err);
                        if (templateError) {
                            const markers = [{
                                severity: monaco.MarkerSeverity.Error,
                                message: templateError.message,
                                startLineNumber: templateError.lineNum + 1,
                                startColumn: 1,
                                endLineNumber: templateError.lineNum + 1,
                                endColumn: editor.getModel().getLineMaxColumn(templateError.lineNum + 1)
                            }];
                            
                            // Set markers only once with the new error
                            monaco.editor.setModelMarkers(editor.getModel(), 'template-errors', markers);
                        }
                    } else {
                        output.setValue(yaml);

                        if (warning) {
                            const markers = [{
                                severity: monaco.MarkerSeverity.Warning,
                                message: `Warning: ${warning}`,
                                startLineNumber: 1,
                                startColumn: 1,
                                endLineNumber: 1,
                                endColumn: 1
                            }];
                            // Set warning markers only once
                            monaco.editor.setModelMarkers(editor.getModel(), 'template-errors', markers);
                        } else {
                            // Clear markers if there's no warning
                            monaco.editor.setModelMarkers(editor.getModel(), 'template-errors', []);
                        }
                    }

                    updateHash(templateValue, valuesValue);
                } catch (error) {
                    console.error('Error in onChange handler:', error);
                    setDebugMessage(`Error in onChange handler: ${error}`);
                }
            };

            // Register change handlers
            editor.onDidChangeModelContent(onChange);
            values.onDidChangeModelContent(onChange);
            
            // Initial render
            setTimeout(onChange, 100); // Small delay to ensure everything is ready
        }).catch(error => {
            showError(`Error loading WASM functionality: ${error.message}`);
            console.error('WASM error:', error);
        });
    }, [editorsReady]);

    const factory = (node: TabNode) => {
        const component = node.getComponent();
        switch (component) {
            case "placeholder":
                return <div className="placeholder">{node.getName()}</div>;
            case "json":
                return <ModelJson model={model} />;
            case "debug-terminal":
                return <div className="debug-terminal">
                    <pre className="debug-terminal-content">{debugMessage}</pre>
                </div>;
            case "monaco-template":
                return <Editor
                    height="100%"
                    width="100%"
                    language="yaml"
                    value={initialValues.template}
                    theme="vs-dark"
                    options={{
                        minimap: { enabled: false },
                        codeLens: true,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        fontSize: 14,
                        wordWrap: 'on',
                        lineNumbers: 'on',
                        renderValidationDecorations: 'on',
                        folding: true,
                        lightbulb: { enabled: monacotypes.ShowLightbulbIconMode.On }
                    }}
                    onMount={(editor, monaco) => {
                        editorRef.current = editor;
                        monacoRef.current = monaco;
                        setEditorsReady(prev => ({
                            ...prev,
                            template: true,
                            monaco: true
                        }));
                    }}
                />;
            case "monaco-values":
                return <Editor
                    height="100%"
                    width="100%"
                    language="yaml"
                    value={initialValues.values}
                    theme="vs-dark"
                    options={{
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        fontSize: 14,
                        wordWrap: 'on',
                        lineNumbers: 'on',
                        folding: true,
                    }}
                    onMount={(editor) => {
                        valuesRef.current = editor;
                        setEditorsReady(prev => ({
                            ...prev,
                            values: true
                        }));
                    }}
                />;
            case "monaco-output":
                return <Editor
                    height="100%"
                    width="100%"
                    language="yaml"
                    value={initialValues.output}
                    theme="vs-dark"
                    options={{
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        readOnly: true,
                        fontSize: 14,
                        wordWrap: 'on',
                        lineNumbers: 'on',
                        folding: true,
                    }}
                    onMount={(editor) => {
                        outputRef.current = editor;
                        setEditorsReady(prev => ({
                            ...prev,
                            output: true
                        }));
                    }}
                />;
            default:
                return <div>{"unknown component " + component}</div>
        }
    }

    const onRenderTabSet = (_node: TabSetNode | BorderNode, _renderValues: ITabSetRenderValues) => {
        // if (node instanceof TabSetNode) {
        //     renderValues.stickyButtons.push(
        //         <button
        //             key="Add"
        //             title="Add"
        //             className="flexlayout__tab_toolbar_button"
        //             onClick={() => {
        //                 model.doAction(Actions.addNode({
        //                     component: "placeholder",
        //                     name: "Added " + nextAddIndex.current++
        //                 }, node.getId(), DockLocation.CENTER, -1, true));
        //             }}
        //         ><AddIcon /></button>);
        // }
    }

    return (
        <Layout
            model={model}
            factory={factory}
            onRenderTabSet={onRenderTabSet}
            realtimeResize={true}
        />
    );
}

// component to show the current model json
function ModelJson({ model }: { model: Model }) {
    const [json, setJson] = useState<string>(JSON.stringify(model.toJson(), null, "\t"));
    const timerRef = useRef<number>(0);

    useEffect(() => {
        timerRef.current = setInterval(() => {
            setJson(JSON.stringify(model.toJson(), null, "\t"));
        }, 500);
        return () => { clearInterval(timerRef.current) }
    }, []);

    return (
        <pre>{json}</pre>
    );
}

export default App;
