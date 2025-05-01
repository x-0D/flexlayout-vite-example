import { useEffect, useRef, useState } from 'react';
import { Layout, Model, TabNode, IJsonModel, TabSetNode, BorderNode, ITabSetRenderValues, Actions, DockLocation, AddIcon } from 'flexlayout-react';
import Editor from '@monaco-editor/react';
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
                    "name": "JSON",
                    "component": "json",
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
                        component: "monaco",
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
                        component: "monaco",
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
                        component: "monaco",
                        "enableClose": false,
                    }
                ]
            }
        ]
    }
};

const model = Model.fromJson(json);

function App() {
    const nextAddIndex = useRef<number>(1);

    const factory = (node: TabNode) => {
        const component = node.getComponent();
        switch (component) {
            case "placeholder":
                return <div className="placeholder">{node.getName()}</div>;
            case "json":
                return <ModelJson model={model}/>;
            case "monaco":
                return                 <Editor
                height="100%"
                width="100%"
                language="yaml"
                defaultValue={`# Example Yaml here
test:
  - name: test
    image: "nginx:latest"
    replicas: 1
    ports:
      - 8080:80`}
                theme="vs-dark"
                options={{
                    minimap: { enabled: true },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    fontSize: 14,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    folding: true
                }}
            />
;
            default:
                return <div>{"unknown component " + component}</div>
        }
    }

    const onRenderTabSet = (node: TabSetNode | BorderNode, renderValues: ITabSetRenderValues) => {
        if (node instanceof TabSetNode) {
            renderValues.stickyButtons.push(
                <button
                    key="Add"
                    title="Add"
                    className="flexlayout__tab_toolbar_button"
                    onClick={() => {
                        model.doAction(Actions.addNode({
                            component: "placeholder",
                            name: "Added " + nextAddIndex.current++
                        }, node.getId(), DockLocation.CENTER, -1, true));
                    }}
                ><AddIcon/></button>);
        }
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
function ModelJson({model}:{model: Model}) {
    const [json, setJson] = useState<string>(JSON.stringify(model.toJson(), null, "\t"));
    const timerRef = useRef<number>(0);

    useEffect(() => {
        timerRef.current = setInterval(() => {
            setJson(JSON.stringify(model.toJson(), null, "\t"));
        }, 500);
        return () => { clearInterval(timerRef.current)}
    }, []);

    return (
        <pre>{json}</pre>
    );
}

export default App;
