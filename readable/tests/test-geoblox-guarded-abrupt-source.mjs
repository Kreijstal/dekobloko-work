import {funorbRepository, workflowRoot} from '../layout.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {captureProcess} from '../tools/lib/capture-process.mjs';
import {sourceInventory, sourceIdentity} from '../tools/readable-java.mjs';

// Recheck the latest structural pass from immutable Git inputs. Guarded exits,
// loop/switch recovery and Boolean predicates share this fixture; earlier source
// remains in its pinned workflow commit. No extra preview is needed.
const repository = funorbRepository;
const javaTools = process.argv[2] && path.resolve(process.argv[2]);
if (!javaTools) throw new Error('Usage: node readable/tests/test-geoblox-guarded-abrupt-source.mjs JAVA_TOOLS_REPOSITORY');
const provenance = JSON.parse(fs.readFileSync(path.join(repository, 'decompilation/geoblox-provenance.json')));
const proof = provenance.terminalControlFrameCleanup ?? provenance.dominatedPredicateRecovery ?? provenance.integralPredicateNegationRecovery ?? provenance.predicateNegationRecovery ?? provenance.scalarIfDispatchRecovery ?? provenance.terminalPrefixBreakRecovery ?? provenance.loopElseExitGuardRecovery ?? provenance.nonlocalLoopExitRecovery ?? provenance.terminalLoopExitRecovery ?? provenance.loopExitContinuationRecovery ?? provenance.trailingLoopRecovery ?? provenance.nonrepeatingLoopRecovery ?? provenance.guardedLoopContinuationRecovery ?? provenance.guardedAbruptSharedExitRecovery ?? provenance.guardedAbruptSuffixRecovery ?? provenance.guardedAbruptExitRecovery;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'geoblox-guarded-abrupt-proof-'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const run = (command, args, cwd = repository) => captureProcess(command, command === 'git' ? ['-C', cwd, ...args] : args).stdout;

try {
  assert.equal(proof.sourceProofTest, 'readable/tests/test-geoblox-guarded-abrupt-source.mjs');
  assert.equal(hash(fs.readFileSync(fileURLToPath(import.meta.url))), proof.sourceProofTestSha256, 'reviewed source proof');
  const toolPin = JSON.parse(fs.readFileSync(path.join(workflowRoot, 'tools/PIN.json')));
  assert.equal(hash(fs.readFileSync(path.join(workflowRoot, 'tools/lib/ReadableJava.java'))), toolPin.files['lib/ReadableJava.java'], 'frozen binding auditor');
  function archive(repo, commit, name, subdirectory) {
    const tar = path.join(temporary, name + '.tar');
    run('git', ['archive', '--format=tar', '--output=' + tar, commit, ...(subdirectory ? [subdirectory] : [])], repo);
    const directory = path.join(temporary, name);
    fs.mkdirSync(directory);
    run('tar', ['-xf', tar, '-C', directory]);
    return {tar, directory};
  }
  const tools = archive(javaTools, proof.javaToolsCommit, 'tools');
  assert.equal(hash(fs.readFileSync(tools.tar)), proof.sourceArchiveSha256, 'tracked decompiler-source tar');
  const before = path.join(archive(repository, proof.previousSourceCommit, 'before', 'games/geoblox').directory, 'games/geoblox');
  const after = path.join(archive(repository, proof.sourceCommit, 'after', 'games/geoblox').directory, 'games/geoblox');
  const beforeFiles = sourceInventory(before), afterFiles = sourceInventory(after);
  assert.equal(beforeFiles.length, 303); assert.equal(afterFiles.length, 303);
  assert.equal(sourceIdentity(beforeFiles), proof.previousSourceTreeSha256);
  assert.equal(sourceIdentity(afterFiles), proof.sourceTreeSha256);
  assert.deepEqual(beforeFiles.map(f => f.path), afterFiles.map(f => f.path));

  const helper = path.join(temporary, 'GeobloxBodyPositions.java');
  fs.writeFileSync(helper, `import com.sun.source.tree.*;
import com.sun.source.util.*;
import javax.tools.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.*;
public final class GeobloxBodyPositions {
  public static void main(String[] args) throws Exception {
    JavaCompiler compiler=ToolProvider.getSystemJavaCompiler();
    DiagnosticCollector<JavaFileObject> diagnostics=new DiagnosticCollector<>();
    try(StandardJavaFileManager manager=compiler.getStandardFileManager(null,null,StandardCharsets.UTF_8);
        Stream<Path> paths=Files.list(Paths.get(args[0]))) {
      List<java.io.File> files=paths.filter(p->p.toString().endsWith(".java")).sorted().map(Path::toFile).collect(Collectors.toList());
      JavacTask task=(JavacTask)compiler.getTask(null,manager,diagnostics,args.length>1?Arrays.asList("-proc:none","-source","8","-classpath",args[1]):Arrays.asList("-proc:none","-source","8"),null,manager.getJavaFileObjectsFromFiles(files));
      Trees trees=Trees.instance(task);
      SourcePositions positions=trees.getSourcePositions();
      List<CompilationUnitTree> units=new ArrayList<>();task.parse().forEach(units::add);
      if(args.length>1)task.analyze();
      if(diagnostics.getDiagnostics().stream().anyMatch(d->d.getKind()==Diagnostic.Kind.ERROR))throw new AssertionError(diagnostics.getDiagnostics());
      for(CompilationUnitTree unit:units) {
        String file=Paths.get(unit.getSourceFile().toUri()).getFileName().toString();
        String source=unit.getSourceFile().getCharContent(true).toString();
        new TreePathScanner<Void,Void>() {
          @Override public Void visitBinary(BinaryTree tree,Void unused) {
            if(args.length>1 && Arrays.asList(Tree.Kind.LESS_THAN,Tree.Kind.LESS_THAN_EQUAL,Tree.Kind.GREATER_THAN,Tree.Kind.GREATER_THAN_EQUAL).contains(tree.getKind())) {
              long leftEnd=positions.getEndPosition(unit,tree.getLeftOperand()),rightStart=positions.getStartPosition(unit,tree.getRightOperand());
              String op=source.substring((int)leftEnd,(int)rightStart).trim();
              if(!Arrays.asList("<","<=",">",">=").contains(op))throw new AssertionError("ambiguous relational operator");
              System.out.println("C\\t"+file+"\\t"+(leftEnd+source.substring((int)leftEnd,(int)rightStart).indexOf(op))+"\\t"+trees.getTypeMirror(new TreePath(getCurrentPath(),tree.getLeftOperand())).getKind()+"\\t"+trees.getTypeMirror(new TreePath(getCurrentPath(),tree.getRightOperand())).getKind());
            }
            return super.visitBinary(tree,unused);
          }
          @Override public Void visitClass(ClassTree tree,Void unused) {
            for(Tree member:tree.getMembers())if(member instanceof BlockTree) {
              System.out.println(file+"\\t"+source.indexOf("{",(int)positions.getStartPosition(unit,member))+"\\t"+positions.getEndPosition(unit,member)+"\\t\\tinitializer");
              if(args.length>2 && args[2].equals("terminal"))verifyTerminalTransfers(unit,positions,file,new TreePath(getCurrentPath(),member));
              else if(args.length>2)verifyGuards(unit,trees,positions,file,new TreePath(getCurrentPath(),member));
            }
            return super.visitClass(tree,unused);
          }
          @Override public Void visitMethod(MethodTree tree,Void unused) {
            if(tree.getBody()!=null && positions.getStartPosition(unit,tree.getBody())>=0 && positions.getEndPosition(unit,tree.getBody())>positions.getStartPosition(unit,tree.getBody())) { System.out.println(file+"\\t"+positions.getStartPosition(unit,tree.getBody())+"\\t"+positions.getEndPosition(unit,tree.getBody())+"\\t"+tree.getParameters().stream().map(p->p.getName().toString()).collect(Collectors.joining(","))+"\\t"+tree.getName()+"\\t"+tree.getParameters().stream().map(p->Base64.getEncoder().encodeToString(p.getType().toString().getBytes(StandardCharsets.UTF_8))).collect(Collectors.joining(",")));
              if(args.length>2 && args[2].equals("terminal"))verifyTerminalTransfers(unit,positions,file,new TreePath(getCurrentPath(),tree.getBody()));
              else if(args.length>2)verifyGuards(unit,trees,positions,file,new TreePath(getCurrentPath(),tree.getBody()));
            }
            return super.visitMethod(tree,unused);
          }
        }.scan(unit,null);
      }
    }
  }
  // Independent JDK AST evidence: normal completion reaches exactly the same
  // plain label exit, or a localized continue reaches the same nearest loop.
  // Protected constructs and loop/switch exits cannot be crossed by E records.
  static void verifyTerminalTransfers(CompilationUnitTree unit,SourcePositions positions,String file,TreePath body) {
    new TreePathScanner<Void,Void>() {
      boolean loop(Tree tree) {
        return Arrays.asList(Tree.Kind.WHILE_LOOP,Tree.Kind.DO_WHILE_LOOP,Tree.Kind.FOR_LOOP,Tree.Kind.ENHANCED_FOR_LOOP).contains(tree.getKind());
      }
      LabeledStatementTree target(javax.lang.model.element.Name name) {
        for(TreePath p=getCurrentPath().getParentPath();p!=null;p=p.getParentPath()) {
          if(p.getLeaf() instanceof MethodTree || p.getLeaf() instanceof ClassTree || p.getLeaf() instanceof LambdaExpressionTree)return null;
          if(p.getLeaf() instanceof LabeledStatementTree && ((LabeledStatementTree)p.getLeaf()).getLabel().contentEquals(name))return (LabeledStatementTree)p.getLeaf();
        }
        return null;
      }
      @Override public Void visitBreak(BreakTree tree,Void unused) {
        if(tree.getLabel()!=null) {
          LabeledStatementTree target=target(tree.getLabel());
          if(target!=null && target.getStatement() instanceof BlockTree) {
            Tree child=tree;TreePath p=getCurrentPath().getParentPath();boolean terminal=true;
            while(p!=null && p.getLeaf()!=target) {
              Tree parent=p.getLeaf();
              if(parent instanceof BlockTree) {
                List<? extends StatementTree> statements=((BlockTree)parent).getStatements();
                if(statements.isEmpty() || statements.get(statements.size()-1)!=child){terminal=false;break;}
              } else if(parent instanceof IfTree) {
                if(((IfTree)parent).getThenStatement()!=child && ((IfTree)parent).getElseStatement()!=child){terminal=false;break;}
              } else if(parent instanceof LabeledStatementTree) {
                if(((LabeledStatementTree)parent).getStatement()!=child || !(child instanceof BlockTree)){terminal=false;break;}
              } else {terminal=false;break;}
              child=parent;p=p.getParentPath();
            }
            if(terminal && p!=null && child==target.getStatement())System.out.println("E\\t"+file+"\\t"+positions.getStartPosition(unit,tree)+"\\t"+positions.getEndPosition(unit,tree)+"\\t"+tree.getLabel());
          }
        }
        return super.visitBreak(tree,unused);
      }
      @Override public Void visitContinue(ContinueTree tree,Void unused) {
        if(tree.getLabel()!=null) {
          LabeledStatementTree target=target(tree.getLabel());Tree nearest=null;
          for(TreePath p=getCurrentPath().getParentPath();p!=null;p=p.getParentPath())if(loop(p.getLeaf())){nearest=p.getLeaf();break;}
          if(target!=null && target.getStatement()==nearest)System.out.println("U\\t"+file+"\\t"+positions.getStartPosition(unit,tree)+"\\t"+positions.getEndPosition(unit,tree)+"\\t"+tree.getLabel());
        }
        return super.visitContinue(tree,unused);
      }
      @Override public Void visitLabeledStatement(LabeledStatementTree tree,Void unused) {
        if(tree.getStatement() instanceof BlockTree) {
          BlockTree block=(BlockTree)tree.getStatement();
          if(block.getStatements().stream().noneMatch(s->s instanceof VariableTree || s instanceof ClassTree))System.out.println("F\\t"+file+"\\t"+positions.getStartPosition(unit,tree)+"\\t"+tree.getLabel()+"\\t"+positions.getStartPosition(unit,block)+"\\t"+positions.getEndPosition(unit,block));
        }
        return super.visitLabeledStatement(tree,unused);
      }
    }.scan(body,null);
  }
  static final class IntComparison {
    final javax.lang.model.element.Element variable;final int value;final boolean equal;
    IntComparison(javax.lang.model.element.Element variable,int value,boolean equal){this.variable=variable;this.value=value;this.equal=equal;}
  }
  static void verifyGuards(CompilationUnitTree unit,Trees trees,SourcePositions positions,String file,TreePath body) {
    Map<javax.lang.model.element.Element,List<Long>> writes=new HashMap<>();
    Set<javax.lang.model.element.Element> cyclic=new HashSet<>();
    Map<javax.lang.model.element.Element,Long> declarations=new HashMap<>(),declarationEnds=new HashMap<>();
    Set<javax.lang.model.element.Element> cyclicDeclarations=new HashSet<>();
    class Analysis extends TreePathScanner<Void,Map<javax.lang.model.element.Element,Map<Integer,Boolean>>> {
      boolean loop(TreePath path) {
        for(TreePath p=path;p!=null;p=p.getParentPath())if(Arrays.asList(Tree.Kind.WHILE_LOOP,Tree.Kind.DO_WHILE_LOOP,Tree.Kind.FOR_LOOP,Tree.Kind.ENHANCED_FOR_LOOP).contains(p.getLeaf().getKind()))return true;
        return false;
      }
      Map<javax.lang.model.element.Element,Map<Integer,Boolean>> copy(Map<javax.lang.model.element.Element,Map<Integer,Boolean>> env) {
        Map<javax.lang.model.element.Element,Map<Integer,Boolean>> result=new HashMap<>();env.forEach((variable,facts)->result.put(variable,new HashMap<>(facts)));return result;
      }
      TreePath strip(TreePath path) {
        while(path.getLeaf() instanceof ParenthesizedTree)path=new TreePath(path,((ParenthesizedTree)path.getLeaf()).getExpression());return path;
      }
      Long literal(TreePath path) {
        path=strip(path);Tree tree=path.getLeaf();
        if(tree instanceof LiteralTree){Object value=((LiteralTree)tree).getValue();return value instanceof Integer?((Integer)value).longValue():null;}
        if(tree instanceof UnaryTree && Arrays.asList(Tree.Kind.UNARY_MINUS,Tree.Kind.UNARY_PLUS).contains(tree.getKind())) {
          Long value=literal(new TreePath(path,((UnaryTree)tree).getExpression()));if(value==null)return null;
          return tree.getKind()==Tree.Kind.UNARY_MINUS?(long)(-(int)(long)value):value;
        }
        return null;
      }
      IntComparison comparison(TreePath path,long site) {
        path=strip(path);Tree tree=path.getLeaf();
        if(!(tree instanceof BinaryTree)||!Arrays.asList(Tree.Kind.EQUAL_TO,Tree.Kind.NOT_EQUAL_TO).contains(tree.getKind()))return null;
        BinaryTree binary=(BinaryTree)tree;TreePath id=strip(new TreePath(path,binary.getLeftOperand())),number=strip(new TreePath(path,binary.getRightOperand()));
        if(!(id.getLeaf() instanceof IdentifierTree)){id=strip(new TreePath(path,binary.getRightOperand()));number=strip(new TreePath(path,binary.getLeftOperand()));}
        if(!(id.getLeaf() instanceof IdentifierTree))return null;
        javax.lang.model.element.Element variable=trees.getElement(id);Long value=literal(number);
        if(variable==null||variable.getKind()!=javax.lang.model.element.ElementKind.LOCAL_VARIABLE||variable.asType().getKind()!=javax.lang.model.type.TypeKind.INT||value==null||value<Integer.MIN_VALUE||value>Integer.MAX_VALUE||cyclicDeclarations.contains(variable)||cyclic.contains(variable)||writes.getOrDefault(variable,Collections.emptyList()).stream().anyMatch(position->position>=site))return null;
        return new IntComparison(variable,value.intValue(),tree.getKind()==Tree.Kind.EQUAL_TO);
      }
      void infer(TreePath path,boolean expected,Map<javax.lang.model.element.Element,Map<Integer,Boolean>> env,long site) {
        path=strip(path);Tree tree=path.getLeaf();
        if(tree.getKind()==Tree.Kind.LOGICAL_COMPLEMENT){infer(new TreePath(path,((UnaryTree)tree).getExpression()),!expected,env,site);return;}
        if(tree instanceof BinaryTree && (tree.getKind()==Tree.Kind.CONDITIONAL_AND&&expected||tree.getKind()==Tree.Kind.CONDITIONAL_OR&&!expected)) {
          BinaryTree binary=(BinaryTree)tree;infer(new TreePath(path,binary.getLeftOperand()),expected,env,site);infer(new TreePath(path,binary.getRightOperand()),expected,env,site);return;
        }
        IntComparison c=comparison(path,site);if(c!=null)env.computeIfAbsent(c.variable,unused->new HashMap<>()).put(c.value,expected==c.equal);
      }
      void record(TreePath path,Map<javax.lang.model.element.Element,Map<Integer,Boolean>> env,long site) {
        path=strip(path);Tree tree=path.getLeaf();
        if(tree.getKind()==Tree.Kind.LOGICAL_COMPLEMENT){record(new TreePath(path,((UnaryTree)tree).getExpression()),env,site);return;}
        if(tree instanceof BinaryTree && Arrays.asList(Tree.Kind.CONDITIONAL_AND,Tree.Kind.CONDITIONAL_OR).contains(tree.getKind())) {
          BinaryTree binary=(BinaryTree)tree;record(new TreePath(path,binary.getLeftOperand()),env,site);
          Map<javax.lang.model.element.Element,Map<Integer,Boolean>> right=copy(env);infer(new TreePath(path,binary.getLeftOperand()),tree.getKind()==Tree.Kind.CONDITIONAL_AND,right,site);record(new TreePath(path,binary.getRightOperand()),right,site);return;
        }
        IntComparison c=comparison(path,site);if(c==null)return;
        Map<Integer,Boolean> facts=env.get(c.variable);if(facts==null)return;Boolean known=null;
        if(facts.containsKey(c.value))known=facts.get(c.value)==c.equal;
        else if(facts.entrySet().stream().anyMatch(fact->fact.getValue()&&fact.getKey()!=c.value))known=!c.equal;
        if(known!=null)System.out.println("G\\t"+file+"\\t"+positions.getStartPosition(unit,tree)+"\\t"+positions.getEndPosition(unit,tree)+"\\t"+known+"\\t"+c.variable.getSimpleName()+"\\t"+declarations.get(c.variable)+"\\tINT\\t"+declarationEnds.get(c.variable));
      }
      @Override public Void visitIf(IfTree tree,Map<javax.lang.model.element.Element,Map<Integer,Boolean>> env) {
        long site=positions.getStartPosition(unit,tree);TreePath test=new TreePath(getCurrentPath(),tree.getCondition());record(test,env,site);
        Map<javax.lang.model.element.Element,Map<Integer,Boolean>> yes=copy(env),no=copy(env);infer(test,true,yes,site);infer(test,false,no,site);scan(tree.getThenStatement(),yes);scan(tree.getElseStatement(),no);return null;
      }
      @Override public Void visitWhileLoop(WhileLoopTree tree,Map<javax.lang.model.element.Element,Map<Integer,Boolean>> env) {
        long site=positions.getStartPosition(unit,tree);TreePath test=new TreePath(getCurrentPath(),tree.getCondition());record(test,env,site);Map<javax.lang.model.element.Element,Map<Integer,Boolean>> inside=copy(env);infer(test,true,inside,site);scan(tree.getStatement(),inside);return null;
      }
      @Override public Void visitForLoop(ForLoopTree tree,Map<javax.lang.model.element.Element,Map<Integer,Boolean>> env) {
        long site=positions.getStartPosition(unit,tree);Map<javax.lang.model.element.Element,Map<Integer,Boolean>> inside=copy(env);scan(tree.getInitializer(),env);
        if(tree.getCondition()!=null){TreePath test=new TreePath(getCurrentPath(),tree.getCondition());record(test,env,site);infer(test,true,inside,site);}scan(tree.getStatement(),inside);scan(tree.getUpdate(),env);return null;
      }
      @Override public Void visitDoWhileLoop(DoWhileLoopTree tree,Map<javax.lang.model.element.Element,Map<Integer,Boolean>> env) {
        scan(tree.getStatement(),copy(env));record(new TreePath(getCurrentPath(),tree.getCondition()),env,positions.getStartPosition(unit,tree));return null;
      }
    }
    Analysis analysis=new Analysis();
    new TreePathScanner<Void,Void>() {
      void written(ExpressionTree expression) {
        TreePath path=analysis.strip(new TreePath(getCurrentPath(),expression));if(!(path.getLeaf() instanceof IdentifierTree))return;
        javax.lang.model.element.Element variable=trees.getElement(path);if(variable==null)return;
        writes.computeIfAbsent(variable,unused->new ArrayList<>()).add(positions.getStartPosition(unit,getCurrentPath().getLeaf()));if(analysis.loop(getCurrentPath()))cyclic.add(variable);
      }
      @Override public Void visitVariable(VariableTree tree,Void unused) {
        javax.lang.model.element.Element variable=trees.getElement(getCurrentPath());declarations.put(variable,positions.getStartPosition(unit,tree));declarationEnds.put(variable,positions.getEndPosition(unit,tree));if(analysis.loop(getCurrentPath()))cyclicDeclarations.add(variable);return super.visitVariable(tree,unused);
      }
      @Override public Void visitAssignment(AssignmentTree tree,Void unused){written(tree.getVariable());return super.visitAssignment(tree,unused);}
      @Override public Void visitCompoundAssignment(CompoundAssignmentTree tree,Void unused){written(tree.getVariable());return super.visitCompoundAssignment(tree,unused);}
      @Override public Void visitUnary(UnaryTree tree,Void unused){if(Arrays.asList(Tree.Kind.PREFIX_INCREMENT,Tree.Kind.PREFIX_DECREMENT,Tree.Kind.POSTFIX_INCREMENT,Tree.Kind.POSTFIX_DECREMENT).contains(tree.getKind()))written(tree.getExpression());return super.visitUnary(tree,unused);}
    }.scan(body,null);
    analysis.scan(body,new HashMap<>());
  }

}
`);
  const helpers = path.join(temporary, 'helpers');
  fs.mkdirSync(helpers);
  run('javac', ['-d', helpers, helper, path.join(workflowRoot, 'tools/lib/ReadableJava.java')]);
  const positionRows = run('java', ['-cp', helpers, 'GeobloxBodyPositions', before,
    ...((proof.integralPredicates || proof.dominatedPredicates || proof.terminalControlFrames) ? [path.join(repository, 'readable/funorb-stubs.jar')] : []), ...(proof.terminalControlFrames ? ['terminal'] : proof.dominatedPredicates ? ['dominated'] : [])]).toString().trim().split('\n').map(line => line.split('\t'));
  const integralEvidence = new Map(positionRows.filter(row => row[0] === 'C').map(row => [row[1] + ':' + row[2], row.slice(3)]));
  const guardEvidence = new Map(positionRows.filter(row => row[0] === 'G').map(row => [row[1] + ':' + row[2] + ':' + row[3], row.slice(4)]));
  const terminalEvidence = new Map(positionRows.filter(row => ['E', 'U', 'F'].includes(row[0])).map(row => [row[0] + ':' + row[1] + ':' + row[2], row]));
  const spans = positionRows.filter(row => !['C', 'G', 'E', 'U', 'F'].includes(row[0])).map(([file, start, end, parameters, method, types]) => {
    const parameterNames = (parameters || '').split(',').filter(Boolean);
    const parameterTypes = (types || '').split(',').filter(Boolean).map(type => Buffer.from(type, 'base64').toString('utf8'));
    assert.equal(parameterNames.length, parameterTypes.length, 'all formal parameter types');
    return {file, start: Number(start), end: Number(end), parameterNames,
      parameters: parameterNames.map((name, index) => ({name, type: parameterTypes[index]}))};
  });
  const require = createRequire(import.meta.url);
  const {recoverPostGuardExits, foldGuardedAbruptPlainBlockExits, foldGuardedLoopContinuations, foldNonrepeatingWhileLoops, foldTrailingLoopContinuations, foldLoopExitContinuations, foldTerminalLoopExits, foldNonlocalLoopExits, foldLoopElseExitGuards, recoverScalarIfDispatches, simplifyPredicateNegations, simplifyDominatedPredicates, finalizeControlFrames} = require(path.join(tools.directory, 'src/decompiler/javaAstEmitter.js'));
  const {tokenizeJava} = require(path.join(tools.directory, 'src/java-frontend/lexer.js'));
  const tokens = source => tokenizeJava(source).tokens.filter(t => !['whitespace', 'eof'].includes(t.kind)).map(t => t.text);
  const lexical = source => tokenizeJava(source).tokens.filter(t => !['whitespace', 'eof'].includes(t.kind));
  const originOrders = new Map(), originLocations = new Map(), changedFiles = new Set(), removedGuardRanges = new Map();
  const bareBreaks = source => { const text = tokens(source); return text.filter((token, index) => token === 'break' && text[index + 1] === ';').length; };
  const counts = {}, sharedSelections = [], trailingSelections = [];
  let methods = 0, files = 0, linesBefore = 0, linesAfter = 0, labelsBefore = 0, labelsAfter = 0;
  let bareBreaksBefore = 0, bareBreaksAfter = 0;
  for (const entry of beforeFiles) {
    const original = fs.readFileSync(path.join(before, entry.path), 'utf8');
    const actual = fs.readFileSync(path.join(after, entry.path), 'utf8');
    const edits = [];
    for (const span of spans.filter(s => s.file === entry.path)) {
      const body = original.slice(span.start + 1, span.end - 1);
      const recover = source => {
        if (proof.terminalControlFrames) {
          const result = finalizeControlFrames(source);
          const totals = Object.fromEntries(['breaksRemoved', 'labelsRemoved', 'jumpsUnlabeled', 'blocksUnwrapped'].map(key => [key, result[key]]));
          if (!result.breaksRemoved) return {source, rewrites: 0, counts: totals};
          assert.ok(!/\\u/.test(source), 'changed body uses direct source offsets');
          const old = lexical(source), next = lexical(result.source);
          const definitions = text => new Set(text.filter((token, index) => token.kind === 'identifier' && text[index + 1]?.text === ':').map(token => token.text));
          const retainedLabels = definitions(next), removedLabels = new Set([...definitions(old)].filter(name => !retainedLabels.has(name)));
          assert.equal(removedLabels.size, result.labelsRemoved);
          const deleted = new Set(), checked = {breaksRemoved: 0, labelsRemoved: 0, jumpsUnlabeled: 0, blocksUnwrapped: 0};
          const evidence = (kind, token) => terminalEvidence.get(kind + ':' + entry.path + ':' + (span.start + 1 + token.range.startOffset));
          for (let index = 0; index < old.length; index++) {
            const token = old[index];
            if (removedLabels.has(token.text) && old[index + 1]?.text === ':') {
              deleted.add(index); deleted.add(index + 1); checked.labelsRemoved++;
              if (old[index + 2]?.text === '{') {
                const fact = evidence('F', token);
                assert.ok(fact, 'JDK proves unwrapped frame has no directly scoped declarations');
                assert.equal(Number(fact[4]), span.start + 1 + old[index + 2].range.startOffset);
                const close = old.findIndex(t => span.start + 1 + t.range.endOffset === Number(fact[5]));
                assert.ok(close > index + 2 && old[close].text === '}');
                deleted.add(index + 2); deleted.add(close); checked.blocksUnwrapped++;
              }
            }
            if (token.text === 'continue' && removedLabels.has(old[index + 1]?.text)) {
              const fact = evidence('U', token);
              assert.ok(fact && fact[4] === old[index + 1].text, 'JDK proves localized continue targets the same nearest loop');
              assert.equal(old[index + 2]?.text, ';'); deleted.add(index + 1); checked.jumpsUnlabeled++;
            }
          }
          const mappedTokens = [];
          let cursor = 0;
          for (let index = 0; index < old.length; index++) {
            if (deleted.has(index)) continue;
            const token = old[index];
            if (token.text !== next[cursor]?.text) {
              const fact = token.text === 'break' && evidence('E', token);
              assert.ok(fact && fact[4] === old[index + 1]?.text && old[index + 2]?.text === ';', 'only independently proven terminal breaks can disappear');
              assert.equal(Number(fact[3]), span.start + 1 + old[index + 2].range.endOffset);
              checked.breaksRemoved++; index += 2; continue;
            }
            mappedTokens.push({text: token.text, origin: token.range.startOffset}); cursor++;
          }
          assert.equal(cursor, next.length, 'no tokens can be inserted or reordered');
          assert.deepEqual(checked, totals, 'all deletions have independent JDK structural evidence');
          return {source: result.source, rewrites: result.breaksRemoved, mappedTokens, counts: totals};
        }
        if (proof.dominatedPredicates) {
          let conditions = 0;
          const totals = {comparisonsRemoved: 0, conjunctionsRemoved: 0, disjunctionsRemoved: 0};
          let mappedCharacters = Array.from({length: source.length}, (_, index) => index);
          for (;;) {
            const result = simplifyDominatedPredicates(source, {retainDiagnostics: true, parameterNames: span.parameterNames});
            if (!result.conditionsSimplified) break;
            const d = result.diagnostics;
            assert.equal(d.removedComparisons.length, d.counts.comparisonsRemoved);
            for (const comparison of d.removedComparisons) {
              const start = span.start + 1 + mappedCharacters[comparison.start], end = span.start + 2 + mappedCharacters[comparison.end - 1];
              const evidence = guardEvidence.get(entry.path + ':' + start + ':' + end);
              assert.ok(evidence, 'JDK independently proves the captured local comparison on this control path');
              assert.equal(evidence[0], String(comparison.known)); assert.equal(evidence[1], comparison.name); assert.equal(evidence[3], 'INT');
              if (!removedGuardRanges.has(entry.path)) removedGuardRanges.set(entry.path, []);
              removedGuardRanges.get(entry.path).push({start, end, name: comparison.name, declaration: Number(evidence[2]), declarationEnd: Number(evidence[4])});
            }
            let expected = source;
            for (const edit of d.deletedRanges.slice().reverse()) {
              assert.ok(edit.start < edit.end, 'nonempty deletion only');
              expected = expected.slice(0, edit.start) + expected.slice(edit.end);
              mappedCharacters.splice(edit.start, edit.end - edit.start);
            }
            assert.equal(result.source, expected, 'exact original source character deletions');
            conditions += result.conditionsSimplified;
            for (const [key, value] of Object.entries(d.counts)) totals[key] += value;
            source = result.source;
          }
          return {source, rewrites: conditions, mappedCharacters, counts: {conditionsSimplified: conditions, ...totals}};
        }
        if (proof.predicateNegations) {
          let predicates = 0;
          const totals = {doubleNegations: 0, equalityComplements: 0, deMorganOperators: 0, booleanLiterals: 0, ...(proof.integralPredicates ? {relationalComplements: 0} : {})};
          let mappedCharacters = Array.from({length: source.length}, (_, index) => index);
          for (;;) {
            const result = simplifyPredicateNegations(source, {retainDiagnostics: true, ...(proof.integralPredicates ? {parameters: span.parameters} : {})});
            if (!result.predicatesSimplified) break;
            if (proof.integralPredicates) {
              const relationalEdits = result.diagnostics.tokenEdits.filter(edit => ['<', '<=', '>', '>='].includes(source.slice(edit.start, edit.end)));
              assert.deepEqual(relationalEdits.map(edit => [edit.start, edit.end]).sort((a,b) => a[0]-b[0]),
                result.diagnostics.relationalComparisons.map(comparison => [comparison.start, comparison.end]).sort((a,b) => a[0]-b[0]), 'every relational edit requires independent type evidence');
              assert.equal(relationalEdits.length, result.diagnostics.counts.relationalComplements);
            }
            if (proof.integralPredicates) for (const comparison of result.diagnostics.relationalComparisons) {
              const origin = mappedCharacters[comparison.start];
              assert.ok(Number.isInteger(origin), 'relational operator is an unchanged original character');
              const types = integralEvidence.get(entry.path + ':' + (span.start + 1 + origin));
              assert.ok(types && types.every(type => ['BYTE', 'SHORT', 'CHAR', 'INT', 'LONG'].includes(type)), 'JDK independently proves both operands integral');
              assert.deepEqual(types.map(type => type.toLowerCase()), [comparison.leftType, comparison.rightType], 'exact independently resolved primitive operand types');
            }
            let expected = source;
            for (const edit of result.diagnostics.tokenEdits.slice().reverse()) {
              const before = source.slice(edit.start, edit.end);
              const allowed = before === '!' && edit.text === ''
                || ({'==': '!=', '!=': '==', '&&': '||', '||': '&&', 'true': 'false', 'false': 'true', ...(proof.integralPredicates ? {'<': '>=', '<=': '>', '>': '<=', '>=': '<'} : {})})[before] === edit.text
                || !before && ['!(', ')'].includes(edit.text);
              assert.ok(allowed, 'only proven predicate operators and grouping can change');
              expected = expected.slice(0, edit.start) + edit.text + expected.slice(edit.end);
              mappedCharacters.splice(edit.start, edit.end - edit.start, ...Array(edit.text.length).fill(null));
            }
            assert.equal(result.source, expected, 'independent exact operator edits');
            predicates += result.predicatesSimplified;
            for (const [key, count] of Object.entries(result.diagnostics.counts)) totals[key] += count;
            source = result.source;
          }
          return {source, rewrites: predicates, mappedCharacters, counts: {predicatesSimplified: predicates, ...totals}};
        }
        if (proof.scalarIfDispatches) {
          let dispatches = 0, comparisonsRemoved = 0, switchExitsAdded = 0;
          let mappedTokens = lexical(source).map(token => ({text: token.text, origin: token.range.startOffset}));
          for (;;) {
            const result = recoverScalarIfDispatches(source, {retainDiagnostics: true});
            if (!result.dispatchesRecovered) break;
            const oldTokens = lexical(source), d = result.diagnostics;
            const slice = range => mappedTokens.filter((_, index) => oldTokens[index].range.startOffset >= range.start
              && oldTokens[index].range.endOffset <= range.end);
            const generated = values => values.flatMap(text => lexical(text).map(token => ({text: token.text, origin: null})));
            const selector = slice({start: d.selectorOrigin, end: d.selectorOrigin + d.selector.length});
            assert.deepEqual(selector.map(token => token.text), [d.selector]);
            for (const condition of d.conditionRanges) {
              const identifiers = slice(condition).filter(token => token.text === d.selector);
              assert.equal(identifiers.length, 1, 'each removed classifier compares exactly one primitive local read');
            }
            const clauses = d.actions.flatMap(action => [
              ...action.cases.flatMap(value => generated(['case', String(value), ':'])),
              ...generated(action.default ? ['default', ':'] : []), ...slice(action.range),
              ...generated(action.exitAdded ? ['break', ';'] : [])]);
            const empty = [...d.emptyCases.flatMap(value => generated(['case', String(value), ':'])),
              ...generated(d.emptyDefault ? ['default', ':'] : []),
              ...generated(d.emptyCases.length || d.emptyDefault ? ['break', ';'] : [])];
            // Keep the selector computation, every action and every existing
            // flag/transfer token; replace only pure integer comparisons. The
            // switch read retains the first original selector token's identity.
            mappedTokens = [...slice({start: 0, end: d.regionRange.start}), ...slice(d.prefixRange),
              ...generated(['switch', '(']), ...selector, ...generated([')', '{']), ...clauses, ...empty,
              ...generated(['}']), ...slice({start: d.regionRange.end, end: source.length})];
            assert.deepEqual(mappedTokens.map(token => token.text), tokens(result.source), 'independent prefix/selector/ordered-actions switch permutation');
            source = result.source; dispatches++; comparisonsRemoved += d.conditionRanges.length;
            switchExitsAdded += d.actions.filter(action => action.exitAdded).length + Number(Boolean(d.emptyCases.length || d.emptyDefault));
          }
          return {source, rewrites: dispatches, mappedTokens, counts: {scalarIfDispatches: dispatches, primitiveComparisonsRemoved: comparisonsRemoved, bareSwitchExitsAdded: switchExitsAdded}};
        }
        if (proof.terminalPrefixBreaks) {
          let loops = 0;
          let mappedTokens = lexical(source).map(token => ({text: token.text, origin: token.range.startOffset}));
          for (;;) {
            const result = foldTerminalLoopExits(source, {parameterNames: span.parameterNames, retainDiagnostics: true});
            if (!result.loopsRecovered) break;
            const oldTokens = lexical(source), d = result.diagnostics;
            assert.equal(d.form, 'doWhile');
            assert.ok(d.retainedPrefixBreakRanges.length, 'only newly supported early-exit loops');
            assert.equal(d.removedLoopLabel, null, 'no label definition removed from this fixed corpus');
            const slice = range => mappedTokens.filter((_, index) => oldTokens[index].range.startOffset >= range.start
              && oldTokens[index].range.endOffset <= range.end);
            const generated = values => values.map(text => ({text, origin: null}));
            // Rebuild independently: intact prefix and every early transfer,
            // then the original guard predicates in ordered short-circuit OR.
            // The terminal bare exit and direct backedges disappear; no prefix
            // jump, protected construct, declaration or identifier is changed.
            const predicates = d.conditionRanges.flatMap((range, index) => [
              ...generated(index ? ['||'] : []), ...generated(d.conditionRanges.length > 1 ? ['('] : []),
              ...slice(range), ...generated(d.conditionRanges.length > 1 ? [')'] : [])]);
            const labels = slice({start: d.loopRange.start, end: d.loopKeywordRange.start});
            mappedTokens = [...slice({start: 0, end: d.loopRange.start}), ...labels, ...generated(['do', '{']),
              ...slice(d.prefixRange), ...generated(['}', 'while', '(']), ...predicates, ...generated([')', ';']),
              ...slice({start: d.loopRange.end, end: source.length})];
            assert.deepEqual(mappedTokens.map(token => token.text), tokens(result.source), 'independent prefix/header token permutation');
            source = result.source; loops += result.loopsRecovered;
          }
          return {source, rewrites: loops, mappedTokens, counts: {terminalPrefixBreaks: loops}};
        }
        if (proof.loopElseExitGuards) {
          let loops = 0;
          let mappedTokens = lexical(source).map(token => ({text: token.text, origin: token.range.startOffset}));
          for (;;) {
            const result = foldLoopElseExitGuards(source, {parameterNames: span.parameterNames, retainDiagnostics: true});
            if (!result.loopsRecovered) break;
            assert.notEqual(result.source, source, 'each terminating else becomes an explicit in-loop guard');
            const oldTokens = lexical(source), d = result.diagnostics;
            const slice = range => mappedTokens.filter((_, index) => oldTokens[index].range.startOffset >= range.start
              && oldTokens[index].range.endOffset <= range.end);
            const generated = values => values.map(text => ({text, origin: null}));
            // Independent permutation, retaining each original token's identity:
            // same loop header, negated predicate and intact false-arm work,
            // new own-loop exit, intact true-arm contents, original bare exit.
            // Both exits remain inside the same loop/protection/monitor depth.
            const before = slice({start: 0, end: d.loopRange.start});
            const after = slice({start: d.loopRange.end, end: source.length});
            const exit = slice(d.exitRange);
            assert.deepEqual(exit.map(token => token.text), ['break', ';']);
            mappedTokens = [...before, ...slice(d.headerRange), ...generated(['if', '(', '!', '(']),
              ...slice(d.conditionRange), ...generated([')', ')']), ...slice(d.alternateRange),
              ...generated(['break', ';', '}']), ...slice(d.armRange), ...exit, ...generated(['}']), ...after];
            assert.deepEqual(mappedTokens.map(token => token.text), tokens(result.source), 'complete independent header/guard/arms/exit token permutation');
            source = result.source; loops += result.loopsRecovered;
          }
          return {source, rewrites: loops, mappedTokens, counts: {loopElseExitGuards: loops}};
        }
        if (proof.nonlocalLoopExits) {
          let loops = 0;
          let mappedTokens = lexical(source).map(token => ({text: token.text, origin: token.range.startOffset}));
          for (;;) {
            const result = foldNonlocalLoopExits(source, {parameterNames: span.parameterNames, retainDiagnostics: true});
            if (!result.loopsRecovered) break;
            assert.notEqual(result.source, source, 'each nonlocal exit guard becomes a loop header');
            const oldTokens = lexical(source), d = result.diagnostics;
            const slice = range => mappedTokens.filter((_, index) => oldTokens[index].range.startOffset >= range.start
              && oldTokens[index].range.endOffset <= range.end);
            const generated = values => values.map(text => ({text, origin: null}));
            // Reconstruct the token permutation independently: header condition,
            // intact remaining body, then the original bare labeled break. Only
            // punctuation is synthesized. Tag every retained original token so
            // a moved break cannot silently borrow another equal-spelled target.
            const before = slice({start: 0, end: d.loopRange.start});
            const after = slice({start: d.loopRange.end, end: source.length});
            const labels = slice({start: d.loopRange.start, end: d.loopKeywordRange.start});
            const condition = slice(d.conditionRange), remainder = slice(d.bodyRange), exit = slice(d.exitRange);
            assert.deepEqual(exit.map(token => token.text), ['break', d.exitTarget, ';']);
            mappedTokens = [...before, ...generated(d.scalarParentWrapped ? ['{'] : []), ...labels,
              ...generated(['while', '(', '!', '(']), ...condition, ...generated([')', ')', '{']),
              ...remainder, ...generated(['}']), ...exit, ...generated(d.scalarParentWrapped ? ['}'] : []), ...after];
            assert.deepEqual(mappedTokens.map(token => token.text), tokens(result.source), 'complete independent header/body/exit token permutation');
            source = result.source; loops += result.loopsRecovered;
          }
          return {source, rewrites: loops, mappedTokens, counts: {nonlocalLoopExits: loops}};
        }
        if (proof.terminalLoopExits) {
          const counts = {terminalLoopExits: 0, whileHeaders: 0, doWhileHeaders: 0, bareExitsRemoved: 0, directContinuesRemoved: 0, loopLabelsRemoved: 0};
          for (;;) {
            const result = foldTerminalLoopExits(source, {parameterNames: span.parameterNames, retainDiagnostics: true});
            if (!result.loopsRecovered) break;
            assert.notEqual(result.source, source, 'each terminal loop gains its original guard header');
            counts.terminalLoopExits += result.loopsRecovered;
            counts[result.diagnostics.form === 'while' ? 'whileHeaders' : 'doWhileHeaders']++;
            counts.bareExitsRemoved += Number(result.diagnostics.terminalBareBreakRemoved);
            counts.directContinuesRemoved += (result.diagnostics.removedContinueRanges || []).length;
            counts.loopLabelsRemoved += Number(Boolean(result.diagnostics.removedLoopLabel));
            source = result.source;
          }
          return {source, rewrites: counts.terminalLoopExits, counts};
        }
        if (proof.loopExitContinuations) {
          let continuations = 0;
          for (;;) {
            const result = foldLoopExitContinuations(source, {parameterNames: span.parameterNames});
            if (!result.continuationsRecovered) break;
            assert.notEqual(result.source, source, 'each continuation leaves a complete repeating prefix');
            source = result.source; continuations += result.continuationsRecovered;
          }
          return {source, rewrites: continuations, counts: {loopExitContinuations: continuations}};
        }
        if (proof.trailingLoopContinuations) {
          let loops = 0, continues = 0;
          const labels = [];
          for (;;) {
            const result = foldTrailingLoopContinuations(source, {parameterNames: span.parameterNames, retainDiagnostics: true});
            if (!result.loopsRecovered) break;
            assert.notEqual(result.source, source, 'each trailing loop consumes direct guard backedges');
            if (result.diagnostics.label) labels.push(result.diagnostics.label);
            continues += result.diagnostics.removedContinueRanges.length;
            source = result.source; loops += result.loopsRecovered;
          }
          return {source, rewrites: loops, labels, counts: {trailingLoopContinuations: loops, directGuardContinuesRemoved: continues}};
        }
        if (proof.nonrepeatingWhileLoops) {
          let conditionals = 0;
          for (;;) {
            const result = foldNonrepeatingWhileLoops(source, {parameterNames: span.parameterNames});
            if (!result.conditionalsRecovered) break;
            assert.notEqual(result.source, source, 'each nonrepeating while becomes an if');
            source = result.source; conditionals += result.conditionalsRecovered;
          }
          return {source, rewrites: conditionals, counts: {nonrepeatingWhileLoops: conditionals}};
        }
        if (!proof.guardedLoopContinuations) return recoverPostGuardExits(source, {parameterNames: span.parameterNames});
        let loops = 0;
        for (;;) {
          const result = foldGuardedLoopContinuations(source, {parameterNames: span.parameterNames});
          if (!result.loopsRecovered) break;
          assert.notEqual(result.source, source, 'each guarded loop removes its entry if');
          source = result.source; loops += result.loopsRecovered;
        }
        return {source, rewrites: loops, counts: {guardedLoopContinuations: loops}};
      };
      const result = recover(body);
      if (!result.rewrites) continue;
      assert.equal(recover(result.source).source, result.source, 'fixed point');
      if (proof.trailingLoopContinuations) trailingSelections.push(...result.labels.map(label => ({...span, label})));
      if (proof.sharedGuardedJumpSelections) {
        let selected = body, jumps = 0;
        for (;;) {
          const folded = foldGuardedAbruptPlainBlockExits(selected, {retainDiagnostics: true});
          if (!folded.jumpsRemoved) break;
          assert.notEqual(folded.source, selected, 'each guarded jump recovery progresses');
          if (folded.diagnostics.labelRetained) sharedSelections.push({...span, label: folded.diagnostics.label});
          selected = folded.source; jumps += folded.jumpsRemoved;
        }
        assert.equal(jumps, result.counts.guardedAbruptJumps, 'independent guarded jump selection replay');
      }
      for (const [name, value] of Object.entries(result.counts)) counts[name] = (counts[name] || 0) + value;
      edits.push({...span, source: result.source, mappedTokens: result.mappedTokens, mappedCharacters: result.mappedCharacters}); methods++;
    }
    edits.sort((a, b) => a.start - b.start);
    assert.ok(edits.every((e, i) => !i || edits[i - 1].end <= e.start), 'nonoverlapping executable edits');
    if (edits.length) {
      changedFiles.add(entry.path);
      // Frontend token offsets refer to Unicode-translated input. Require direct
      // source offsets for changed files; byte-identical files can retain their
      // original compiler positions without interpreting that translation.
      if (proof.loopElseExitGuards || proof.terminalPrefixBreaks || proof.scalarIfDispatches || proof.terminalControlFrames) assert.ok(!/\\u/.test(original), 'changed file has direct source/token offsets');
    }
    if (proof.predicateNegations || proof.dominatedPredicates) {
      let characters = Array.from({length: original.length}, (_, index) => index);
      for (const edit of edits.slice().reverse()) characters = [...characters.slice(0, edit.start + 1),
        ...edit.mappedCharacters.map(origin => origin === null ? null : edit.start + 1 + origin), ...characters.slice(edit.end - 1)];
      assert.equal(characters.length, actual.length);
      const locations = new Map();
      characters.forEach((origin, index) => {
        if (origin === null) return;
        assert.ok(!locations.has(origin), 'every retained source character occurs once');
        locations.set(origin, index);
      });
      originLocations.set(entry.path, locations);
    }
    if (proof.nonlocalLoopExits || proof.loopElseExitGuards || proof.terminalPrefixBreaks || proof.scalarIfDispatches || proof.terminalControlFrames) {
      const originalTokens = lexical(original);
      let expectedTokens = originalTokens.map(token => ({text: token.text, origin: token.range.startOffset}));
      for (const edit of edits.slice().reverse()) {
        const start = originalTokens.findIndex(token => token.range.startOffset >= edit.start + 1);
        let end = originalTokens.findIndex(token => token.range.startOffset >= edit.end - 1);
        if (end < 0) end = originalTokens.length;
        expectedTokens.splice(start, end - start, ...edit.mappedTokens.map(token => ({...token,
          origin: token.origin === null ? null : edit.start + 1 + token.origin})));
      }
      assert.deepEqual(expectedTokens.map(token => token.text), tokens(actual), 'all executable permutations and unchanged file tokens');
      const order = new Map(), locations = new Map(), actualTokens = lexical(actual);
      expectedTokens.forEach((token, index) => {
        if (token.origin === null) return;
        assert.ok(!order.has(token.origin), 'retained original token occurs once'); order.set(token.origin, index);
        locations.set(token.origin, actualTokens[index].range.startOffset);
      });
      originOrders.set(entry.path, order);
      originLocations.set(entry.path, locations);
    }
    let expected = original;
    for (const edit of edits.reverse()) expected = expected.slice(0, edit.start + 1) + edit.source + expected.slice(edit.end - 1);
    assert.deepEqual(tokens(actual), tokens(expected), entry.path + ' complete expected token stream');
    if (proof.predicateNegations || proof.dominatedPredicates || proof.terminalControlFrames) assert.equal(actual, expected, entry.path + ' exact expected source bytes');
    if (!edits.length) assert.equal(actual, original, entry.path + ' unchanged bytes');
    else files++;
    linesBefore += original.split('\n').length - 1; linesAfter += actual.split('\n').length - 1;
    labelsBefore += (original.match(/^\s+L\d+:\s*\{/gm) || []).length;
    labelsAfter += (actual.match(/^\s+L\d+:\s*\{/gm) || []).length;
    if (proof.loopExitContinuations || proof.terminalLoopExits || proof.loopElseExitGuards || proof.terminalPrefixBreaks || proof.scalarIfDispatches) { bareBreaksBefore += bareBreaks(original); bareBreaksAfter += bareBreaks(actual); }
  }
  assert.equal(methods, proof.changedMethodBodies); assert.equal(files, proof.changedJavaFiles);
  assert.equal(linesBefore, proof.sourceLinesBefore); assert.equal(linesAfter, proof.sourceLinesAfter);
  assert.equal(labelsBefore, proof.plainBlockLabelsBefore); assert.equal(labelsAfter, proof.plainBlockLabelsAfter);
  assert.deepEqual(counts, proof.counts);
  if (proof.integralPredicates) assert.equal(counts.relationalComplements, proof.independentlyAttributedIntegralComparisons);
  if (proof.scalarIfDispatches) assert.equal(bareBreaksAfter - bareBreaksBefore, proof.counts.bareSwitchExitsAdded, 'all new bare switch exits accounted for');
  if (proof.loopExitContinuations) assert.equal(bareBreaksAfter - bareBreaksBefore, proof.bareLoopExitsAdded, 'all added bare loop exits accounted for');
  if (proof.loopElseExitGuards) assert.equal(bareBreaksAfter - bareBreaksBefore, proof.bareLoopExitsAdded, 'one new bare exit per terminating else guard');
  if (proof.terminalPrefixBreaks) assert.equal(bareBreaksBefore - bareBreaksAfter, proof.counts.terminalPrefixBreaks, 'one final bare exit consumed per recovered loop');
  if (proof.terminalLoopExits) assert.equal(bareBreaksBefore - bareBreaksAfter, proof.counts.bareExitsRemoved, 'all consumed bare loop exits accounted for');

  const list = path.join(temporary, 'files.txt');
  fs.writeFileSync(list, beforeFiles.map(f => f.path).join('\n') + '\n');
  const stubs = path.join(repository, 'readable/funorb-stubs.jar');
  assert.equal(hash(fs.readFileSync(stubs)), provenance.stubJar.sha256);
  function audit(root, name) {
    const report = path.join(temporary, name + '.tsv');
    run('java', ['-cp', helpers, 'ReadableJava', root, list, report, path.join(temporary, name + '-classes'), stubs, '--labels']);
    return fs.readFileSync(report, 'utf8').trim().split('\n').map(line => line.split('\t'));
  }
  const oldAudit = audit(before, 'old'), newAudit = audit(after, 'new');
  const removedGuardReads = new Set();
  if (proof.dominatedPredicates) {
    for (const [file, guards] of removedGuardRanges) for (const guard of guards) {
      const references = oldAudit.filter(row => row[0] === 'R' && row[1] === file
        && Number(row[2]) >= guard.start && Number(row[3]) <= guard.end);
      assert.equal(references.length, 1, 'every removed comparison contains exactly one captured local read');
      const declarations = oldAudit.filter(row => row[0] === 'D' && row[1] === file && row[5] === guard.name
        && Number(row[2]) >= guard.declaration && Number(row[3]) <= guard.declarationEnd);
      assert.equal(declarations.length, 1, 'independent JDK local declaration maps to one compiler binding');
      assert.equal(references[0][4], declarations[0][4], 'removed read targets the exact independently proven primitive local');
      assert.equal(references[0][5], guard.name);
      const key = file + ':' + references[0][2];
      assert.ok(!removedGuardReads.has(key)); removedGuardReads.add(key);
    }
    assert.equal(removedGuardReads.size, proof.primitiveReferenceOccurrencesRemoved);
  }

  for (const [kind, count] of [['D', proof.sourceDeclarationsBefore], ['R', proof.sourceReferenceOccurrencesBefore]]) {
    const identities = rows => rows.filter(r => r[0] === kind).map(r => [r[1], r[4], r[5]]);
    assert.equal(identities(oldAudit).length, count);
    assert.equal(identities(newAudit).length, kind === 'D' ? proof.sourceDeclarationsAfter : proof.sourceReferenceOccurrencesAfter);
    if (proof.terminalControlFrames) {
      const positioned = (row, transform) => {
        const start = transform ? originLocations.get(row[1]).get(Number(row[2])) : Number(row[2]);
        assert.notEqual(start, undefined, 'every ordinary binding token survives exactly once');
        return [row[1], start, start + Number(row[3]) - Number(row[2]), row[4], row[5]];
      };
      assert.deepEqual(newAudit.filter(row => row[0] === kind).map(row => positioned(row, false)),
        oldAudit.filter(row => row[0] === kind).map(row => positioned(row, changedFiles.has(row[1]))),
        'every ordered ordinary declaration/reference position and identity survives');
    } else if (proof.predicateNegations || proof.dominatedPredicates) {
      if (proof.dominatedPredicates) for (const row of oldAudit.filter(row => row[0] === kind && changedFiles.has(row[1])))
        assert.equal(!originLocations.get(row[1]).has(Number(row[2])), kind === 'R' && removedGuardReads.has(row[1] + ':' + row[2]), 'only independently proven pure comparison reads can disappear');
      const retained = oldAudit.filter(row => row[0] === kind && !(kind === 'R' && removedGuardReads.has(row[1] + ':' + row[2])));
      assert.deepEqual(identities(newAudit), retained.map(row => [row[1], row[4], row[5]]), 'all ordered surviving declarations/references remain');
      const positioned = (row, transform) => {
        const location = offset => transform ? originLocations.get(row[1]).get(Number(offset)) : Number(offset);
        const start = location(row[2]), end = location(Number(row[3]) - 1);
        assert.notEqual(start, undefined, 'bound name start survives');
        assert.notEqual(end, undefined, 'bound name end survives');
        return [row[1], start, end + 1, row[4], row[5]];
      };
      assert.deepEqual(newAudit.filter(row => row[0] === kind).map(row => positioned(row, false)),
        retained.map(row => positioned(row, changedFiles.has(row[1]))),
        'every bound name position and identity follows the independent source-character map');
    } else if ((proof.loopElseExitGuards || proof.terminalPrefixBreaks || proof.scalarIfDispatches) && kind === 'R') {
      const expected = oldAudit.filter(row => row[0] === kind).map(row => {
        const location = changedFiles.has(row[1]) ? originLocations.get(row[1]).get(Number(row[2])) : Number(row[2]);
        if (proof.scalarIfDispatches && location === undefined) return null;
        assert.notEqual(location, undefined, 'every original reference token survives exactly once: ' + JSON.stringify(row));
        return [row[1], location, row[4], row[5]];
      }).filter(Boolean).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]);
      if (proof.scalarIfDispatches) {
        const removed = oldAudit.filter(row => row[0] === kind && changedFiles.has(row[1])
          && !originLocations.get(row[1]).has(Number(row[2])));
        assert.equal(removed.length, proof.primitiveReferenceOccurrencesRemoved);
        assert.ok(removed.every(row => proof.classifierSymbols.includes(row[4])), 'only recorded primitive classifier reads disappear');
      }
      assert.deepEqual(newAudit.filter(row => row[0] === kind).map(row => [row[1], Number(row[2]), row[4], row[5]])
        .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]),
        expected, 'all surviving per-occurrence bindings follow the independently tagged token permutation');
    } else assert.deepEqual(identities(newAudit), identities(oldAudit), 'all ordered ' + kind + ' bindings and local ordinals');
  }
  const declarations = rows => rows.filter(r => r[0] === 'T');
  const oldLabels = declarations(oldAudit), newLabels = declarations(newAudit);
  assert.equal(oldLabels.length, proof.labelDeclarationsBefore);
  assert.equal(newLabels.length, proof.labelDeclarationsAfter);
  const labelIdentity = row => JSON.stringify([row[1], row[4].slice(0, row[4].lastIndexOf('#')), row[5]]);
  const labelTargets = new Map(newLabels.map(row => [labelIdentity(row), row[4]]));
  assert.equal(labelTargets.size, newLabels.length, 'unique original label spelling in each enclosing method');
  const mapping = new Map(oldLabels.map(row => [row[4], labelTargets.get(labelIdentity(row))]));
  let migrations = 0;
  for (const [before, after] of mapping) if (after && before !== after) migrations++;
  assert.equal(migrations, proof.survivingLabelOrdinalMigrations);
  if (proof.terminalControlFrames) {
    assert.deepEqual(oldLabels.filter(row => mapping.get(row[4]) && mapping.get(row[4]) !== row[4])
      .map(row => ({before: row[4], after: mapping.get(row[4]), originalName: row[5]})), proof.labelOrdinalMigrations);
    assert.deepEqual(oldLabels.filter(row => !mapping.get(row[4]))
      .map(row => ({symbol: row[4], originalName: row[5]})), proof.retiredLabelIdentities);
    const current = JSON.parse(fs.readFileSync(path.join(workflowRoot, 'geoblox-rules.json')));
    const previousBytes = captureProcess('git', ['-C', path.dirname(workflowRoot), 'show',
      current.publication.previousRules.commit + ':' + current.publication.previousRules.path], {maxBuffer: 128 * 1024 * 1024}).stdout;
    assert.equal(hash(previousBytes), current.publication.previousRules.sha256);
    const previous = JSON.parse(previousBytes), expected = previous.renames.flatMap(rule =>
      rule.symbol.startsWith('B:') ? mapping.get(rule.symbol) ? [{...rule, symbol: mapping.get(rule.symbol)}] : [] : [rule]);
    const sort = rules => rules.slice().sort((a, b) => a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0);
    assert.deepEqual(sort(current.renames), sort(expected), 'only exact retired/migrated label identities change complete naming rules');
    assert.equal(previous.renames.length, proof.previousCompleteRules);
    assert.equal(previous.renames.filter(rule => !rule.symbol.startsWith('B:') || mapping.get(rule.symbol) === rule.symbol).length,
      proof.unaffectedCompleteRulesPreserved);
  }
  const records = rows => rows.filter(r => ['T', 'B', 'N'].includes(r[0]));
  const selectedTargets = sharedSelections.map(span => {
    const declarations = oldLabels.filter(row => row[1] === span.file && row[5] === span.label
      && Number(row[2]) >= span.start && Number(row[3]) <= span.end);
    assert.equal(declarations.length, 1, 'unique original selected label in the executable scope');
    return {file: span.file, symbol: declarations[0][4], originalName: span.label};
  });
  if (proof.sharedGuardedJumpSelections) assert.deepEqual(selectedTargets, proof.sharedGuardedJumpSelections, 'all independently selected shared frame exits');
  const pending = new Set(selectedTargets.filter(target => mapping.get(target.symbol)).map(target => target.symbol));
  assert.equal(pending.size, selectedTargets.filter(target => mapping.get(target.symbol)).length, 'at most one selected guarded jump per surviving frame');
  const expectedRecords = records(oldAudit).filter(row => mapping.get(row[4])).filter(row => {
    if (proof.terminalControlFrames && changedFiles.has(row[1]) && !originLocations.get(row[1]).has(Number(row[2]))) return false;
    if (proof.trailingLoopContinuations && row[0] === 'N' && trailingSelections.some(span => row[1] === span.file
        && row[5] === span.label && Number(row[2]) >= span.start && Number(row[3]) <= span.end)) return false;
    if (row[0] !== 'B' || !pending.has(row[4])) return true;
    // The destination proof permits all other references only in the complete
    // fallback. Its selected direct guard is therefore the first old break to
    // this label. Prune only that reference, never another fallback transfer.
    pending.delete(row[4]); return false;
  });
  if (proof.nonlocalLoopExits || proof.loopElseExitGuards || proof.terminalPrefixBreaks || proof.scalarIfDispatches) {
    for (const row of expectedRecords) if (!(proof.loopElseExitGuards || proof.terminalPrefixBreaks || proof.scalarIfDispatches) || changedFiles.has(row[1]))
      assert.ok(originOrders.get(row[1]).has(Number(row[2])), 'every original label token survives exactly once');
    const order = row => (proof.loopElseExitGuards || proof.terminalPrefixBreaks || proof.scalarIfDispatches) && !changedFiles.has(row[1]) ? Number(row[2])
      : originOrders.get(row[1]).get(Number(row[2]));
    expectedRecords.sort((a, b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1
      : order(a) - order(b));
  }
  const expectedLabels = expectedRecords.map(row => [row[0], row[1], mapping.get(row[4]), row[5]]);
  assert.equal(pending.size, 0, 'every selected surviving-frame break accounted for');
  const actualLabels = records(newAudit).map(row => [row[0], row[1], row[4], row[5]]);
  assert.equal(records(oldAudit).length, proof.labelBindingsBefore);
  assert.equal(actualLabels.length, proof.labelBindingsAfter);
  if (proof.trailingLoopContinuations) assert.equal(records(oldAudit).length - actualLabels.length,
    proof.labeledGuardContinuesRemoved, 'only own labeled guard backedges are consumed');
  assert.deepEqual(actualLabels, expectedLabels, 'all ordered surviving label declarations, destinations and transfer kinds');
  if (proof.terminalControlFrames) {
    assert.equal(oldLabels.length - newLabels.length, proof.counts.labelsRemoved);
    for (const kind of ['B', 'N']) assert.equal(records(oldAudit).filter(row => row[0] === kind).length - records(newAudit).filter(row => row[0] === kind).length,
      kind === 'B' ? proof.counts.breaksRemoved : proof.counts.jumpsUnlabeled);
    const positioned = (row, transform) => {
      const start = transform ? originLocations.get(row[1]).get(Number(row[2])) : Number(row[2]);
      assert.notEqual(start, undefined);
      return [row[0], row[1], start, start + Number(row[3]) - Number(row[2]), transform ? mapping.get(row[4]) : row[4], row[5]];
    };
    assert.deepEqual(records(newAudit).map(row => positioned(row, false)),
      expectedRecords.map(row => positioned(row, changedFiles.has(row[1]))), 'all retained lexical label token positions, kinds and migrated targets');
  }
  if (proof.predicateNegations || proof.dominatedPredicates) {
    const positioned = (row, transform) => {
      const location = offset => transform ? originLocations.get(row[1]).get(Number(offset)) : Number(offset);
      const start = location(row[2]), end = location(Number(row[3]) - 1);
      assert.notEqual(start, undefined); assert.notEqual(end, undefined);
      return [row[0], row[1], start, end + 1, row[4], row[5]];
    };
    assert.deepEqual(records(newAudit).map(row => positioned(row, false)),
      records(oldAudit).map(row => positioned(row, changedFiles.has(row[1]))), 'every lexical label position and target survives');
  }
  if (proof.largeLabeledBodiesAfter) {
    const inventory = [];
    let methodBodies = 0, largeMethodBodies = 0, largePlainBlockMethodBodies = 0;
    for (const line of run('java', ['-cp', helpers, 'GeobloxBodyPositions', after]).toString().trim().split('\n')) {
      const [file, start, end, parameters, executable] = line.split('\t');
      const source = fs.readFileSync(path.join(after, file), 'utf8');
      const body = source.slice(Number(start), Number(end));
      const lines = body.split('\n').length;
      if (executable !== 'initializer') {
        methodBodies++;
        if (lines >= proof.largeLabeledBodiesAfter.minimumBodyLines) {
          largeMethodBodies++;
          if (/^\s*L\d+:\s*\{/m.test(body)) largePlainBlockMethodBodies++;
        }
      }
      const labels = newLabels.filter(row => row[1] === file && Number(row[2]) >= Number(start) && Number(row[3]) <= Number(end));
      if (lines < proof.largeLabeledBodiesAfter.minimumBodyLines || !labels.length) continue;
      const enclosingMethod = labels[0][4].slice(2, labels[0][4].lastIndexOf('#'));
      assert.ok(labels.every(row => row[4].slice(2, row[4].lastIndexOf('#')) === enclosingMethod), 'no nested executable inventory ambiguity');
      inventory.push({rawFile: file, enclosingMethod, lines, labels: labels.length});
    }
    if (proof.terminalPrefixBreaks || proof.scalarIfDispatches || proof.predicateNegations || proof.dominatedPredicates || proof.terminalControlFrames) {
      assert.equal(methodBodies, proof.methodBodiesAfter);
      assert.equal(largeMethodBodies, proof.largeMethodBodiesAfter);
      assert.equal(largePlainBlockMethodBodies, proof.largeMethodBodiesWithPlainBlockLabelsAfter);
    }
    assert.equal(inventory.length, proof.largeLabeledBodiesAfter.bodies);
    assert.deepEqual(inventory, proof.largeLabeledBodiesAfter.inventory.map(({rawFile, enclosingMethod, lines, labels}) =>
      ({rawFile, enclosingMethod, lines, labels})).sort((a, b) => a.rawFile < b.rawFile ? -1 : a.rawFile > b.rawFile ? 1 : 0), 'complete large labeled-body inventory');
  }
  const overrides = rows => rows.filter(r => r[0] === 'O');
  assert.equal(overrides(oldAudit).length, proof.fullOverridePairsPreserved);
  assert.deepEqual(overrides(newAudit), overrides(oldAudit), 'complete ordered override pairs');
  assert.equal(fs.readFileSync(path.join(repository, 'decompilation/geoblox-decompiler-diagnostics.json'), 'utf8'),
    run('git', ['show', proof.previousSourceCommit + ':decompilation/geoblox-decompiler-diagnostics.json']).toString(), 'diagnostics unchanged');
  console.log(JSON.stringify({filesChecked: 303, changedFiles: files, changedMethods: methods, labelsBefore, labelsAfter,
    declarations: proof.sourceDeclarationsAfter, references: proof.sourceReferenceOccurrencesAfter, overrides: proof.fullOverridePairsPreserved,
    counts, ...(proof.dominatedPredicates ? {independentlyProvenGuardComparisons: removedGuardReads.size} : {}), ...(proof.integralPredicates ? {independentlyAttributedIntegralComparisons: counts.relationalComplements} : {}), labelBindings: actualLabels.length, survivingLabelOrdinalMigrations: migrations, sourceArchiveSha256: proof.sourceArchiveSha256, exactExpectedTokenStreams: true,
    orderedJavaDeclarationsUnchanged: true, ...(proof.terminalControlFrames ? {survivingPerOccurrenceJavaAndLabelBindingsPreserved: true, independentJdkTransferAndScopeEvidence: true, exactExpectedSourceBytes: true} : proof.dominatedPredicates ? {survivingPerOccurrenceJavaAndLabelBindingsPreserved: true, purePrimitiveReadsRemoved: removedGuardReads.size, exactExpectedSourceBytes: true} : proof.predicateNegations ? {perOccurrenceJavaAndLabelBindingsPreserved: true, exactExpectedSourceBytes: true} : proof.scalarIfDispatches ? {survivingPerOccurrenceJavaBindingsPreserved: true, purePrimitiveReadsRemoved: proof.primitiveReferenceOccurrencesRemoved}
      : (proof.loopElseExitGuards || proof.terminalPrefixBreaks) ? {perOccurrenceJavaBindingsPreserved: true} : {orderedJavaBindingsUnchanged: true})}));
} finally {
  fs.rmSync(temporary, {recursive: true, force: true});
}
