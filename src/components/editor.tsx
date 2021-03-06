import React, {Component} from "react";
import {connect, Dispatch} from 'react-redux'
import MonacoEditor from 'react-monaco-editor';
import {Position, TextDocument} from 'vscode-languageserver-types'
import {RootAction, RootState} from "../store";
import {editorCodeChange} from "../store/coding/actions";
import ReactResizeDetector from "react-resize-detector";
import {LspService} from 'ride-language-server/out/LspService'
import debounce from "debounce";

const LANGUAGE_ID = 'ride';
const THEME_ID = 'wavesDefaultTheme';

interface IEditorProps {
    code: string
    error: string
    onCodeChanged: (code: string) => void
}

class EditorComponent extends Component<IEditorProps> {

    editor: monaco.editor.ICodeEditor | null = null;
    languageService = new LspService();
    state = {height: 0, width: 0}

    editorWillMount = (m: typeof monaco) => {
        if (m.languages.getLanguages().every(x => x.id != LANGUAGE_ID)) {

            m.languages.register({
                id: LANGUAGE_ID,
            });



            const keywords = ["let", "true", "false", "if", "then", "else", "match", "case"]
            const intr = ['ExchangeTransaction']


            const language = {
                tokenPostfix: '.',
                tokenizer: {
                    root: [
                        {regex: /base58'/, action: {token: 'literal', bracket: '@open', next: '@base58literal'}},
                        {regex: /base64'/, action: {token: 'literal', bracket: '@open', next: '@base64literal'}},
                        {include: '@whitespace'},
                        {
                            regex: /[a-z_$][\w$]*/, action: {
                                cases: {
                                    '@keywords': 'keyword'
                                }
                            }
                        },
                        {regex: /ExchangeTransaction/, action: {token: 'intr'}},
                        {regex: /"([^"\\]|\\.)*$/, action: {token: 'string.invalid'}},
                        {regex: /"/, action: {token: 'string.quote', bracket: '@open', next: '@string'}},
                    ],
                    whitespace: [
                        //{ regex: /^[ \t\v\f]*#\w.*$/, action: { token: 'namespace.cpp' } },
                        {regex: /[ \t\v\f\r\n]+/, action: {token: 'white'}},
                        //{ regex: /\/\*/, action: { token: 'comment', next: '@comment' } },
                        {regex: /#.*$/, action: {token: 'comment'}},
                    ],
                    base58literal: [
                        {
                            regex: /[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+/,
                            action: {token: 'literal'}
                        },
                        {regex: /'/, action: {token: 'literal', bracket: '@close', next: '@pop'}}
                    ],
                    base64literal: [
                        {
                            regex: /[[A-Za-z0-9+/=]+/,
                            action: {token: 'literal'}
                        },
                        {regex: /'/, action: {token: 'literal', bracket: '@close', next: '@pop'}}
                    ],
                    string: [
                        {regex: /[^\\"]+/, action: {token: 'string'}},
                        {regex: /"/, action: {token: 'string.quote', bracket: '@close', next: '@pop'}}
                    ]
                },
                keywords, intr
            }


            //m.languages.setLanguageConfiguration(LANGUAGE_ID, {})
            m.languages.setLanguageConfiguration(LANGUAGE_ID, {brackets: [['{', '}'], ['(', ')']]})
            m.languages.setMonarchTokensProvider(LANGUAGE_ID, language)

            m.languages.registerCompletionItemProvider(LANGUAGE_ID, {
                triggerCharacters: ['.', ':'],
                provideCompletionItems: (
                    model: monaco.editor.IReadOnlyModel, position: monaco.Position, token: monaco.CancellationToken
                ):
                    monaco.languages.CompletionItem[]  => {
                    const textDocument =  TextDocument.create(model.uri.toString(),LANGUAGE_ID,1, model.getValue());
                    const convertedPosition: Position = {
                            line: position.lineNumber - 1,
                            character: position.column - 1
                    };

                    return this.languageService.completion(textDocument, convertedPosition).map(item => (
                        {...item, insertText: {value: item.insertText}, kind: item.kind! - 1 }
                        //Object.assign({}, item, {insertText: {value: item.insertText}})
                    )) as any
                },
            })

            // m.editor.defineTheme(THEME_ID, {
            //     base: 'vs',
            //     colors: {},
            //     inherit: false,
            //     rules: [
            //         {token: 'keyword', foreground: '294F6D', fontStyle: 'bold'},
            //         {token: 'intr', foreground: '204F0D', fontStyle: 'bold'},
            //         {token: 'literal', foreground: '7ed619'},
            //         {token: 'string', foreground: '7ed619'},
            //         {token: 'comment', foreground: 'cccccc'}
            //     ]
            // })
        }
    }

    onChange = (newValue: string, e: monaco.editor.IModelContentChangedEvent) => {
        this.props.onCodeChanged(newValue);
        this.validateDocument()
    }

    validateDocument = () => {
        if (this.editor){
            const model = this.editor.getModel();
            const document = TextDocument.create(model.uri.toString(),LANGUAGE_ID,1, model.getValue());
            const errors = this.languageService.validateTextDocument(document).map(diagnostic =>({
                ...diagnostic,
                startLineNumber: diagnostic.range.start.line + 1,
                startColumn: diagnostic.range.start.character + 1,
                endLineNumber: diagnostic.range.end.line + 1,
                endColumn: diagnostic.range.end.character + 1,
                code: diagnostic.code ? diagnostic.code.toString() : undefined,
                severity: monaco.Severity.Error
            }))
            monaco.editor.setModelMarkers(this.editor.getModel(), null as any, errors)
        }
    }
    onResize = (width: number, height: number) => {
        this.setState({width,height})
    }

    componentDidMount = () => {
        //const root = document.getElementById('editor_root')
        //root.style.height = (window.outerHeight - root.getBoundingClientRect().top).toString() + 'px'
    }

    editorDidMount = (e: monaco.editor.ICodeEditor, m: typeof monaco) => {
        this.editor = e;
        this.validateDocument()
    }


    render() {
        const {width} = this.state;
        const options: monaco.editor.IEditorConstructionOptions = {
            language: LANGUAGE_ID,
            selectOnLineNumbers: true,
            glyphMargin: true,
            autoClosingBrackets: true,
            minimap: {enabled: false},
            contextmenu: false,
            renderLineHighlight: 'none',
            scrollBeyondLastLine: false,
            scrollbar: {vertical: 'hidden', horizontal: 'hidden'},
           // hideCursorInOverviewRuler: true,
            overviewRulerLanes: 0,
            wordBasedSuggestions: true,
            acceptSuggestionOnEnter: 'on'
        };

        return (
            <div id='editor_root' style={{height: '100%', width: '100%', overflow: 'hidden', padding: '6px'}}>
                <MonacoEditor
                    width={width}
                    height='100%'
                    theme={THEME_ID}
                    language={LANGUAGE_ID}
                    value={this.props.code}
                    options={options}
                    onChange={debounce(this.onChange, 1000)}
                    editorDidMount={this.editorDidMount}
                    editorWillMount={this.editorWillMount}
                />
                <ReactResizeDetector handleWidth={true} handleHeight={true} onResize={this.onResize}/>
            </div>
        );
    }
}

const mapStateToProps = (state: RootState) => {
    const editor = state.coding.editors[state.coding.selectedEditor]
    if (!editor) return {code: ''}
    const error = editor.compilationResult ? (editor.compilationResult as any).error : undefined
    return {code: (editor || {code: ''}).code, error}
}

const mapDispatchToProps = (dispatch: Dispatch<RootAction>) => ({
    onCodeChanged: (code: string) => {
        dispatch(editorCodeChange(code))
    }
})

export const Editor = connect(mapStateToProps, mapDispatchToProps)(EditorComponent);
