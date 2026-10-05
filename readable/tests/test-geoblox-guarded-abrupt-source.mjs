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
const proof = provenance.booleanLocalAssignmentRecovery ?? provenance.scalarSwitchPrefixRecovery ?? provenance.nestedScalarDispatchRecovery ?? provenance.predicateGroupingRecovery ?? provenance.ownedFieldPredicateRecovery ?? provenance.terminalLoopTailRecovery ?? provenance.redundantExitGuardRecovery ?? provenance.terminalSwitchFrameCleanup ?? provenance.terminalControlFrameCleanup ?? provenance.dominatedPredicateRecovery ?? provenance.integralPredicateNegationRecovery ?? provenance.predicateNegationRecovery ?? provenance.scalarIfDispatchRecovery ?? provenance.terminalPrefixBreakRecovery ?? provenance.loopElseExitGuardRecovery ?? provenance.nonlocalLoopExitRecovery ?? provenance.terminalLoopExitRecovery ?? provenance.loopExitContinuationRecovery ?? provenance.trailingLoopRecovery ?? provenance.nonrepeatingLoopRecovery ?? provenance.guardedLoopContinuationRecovery ?? provenance.guardedAbruptSharedExitRecovery ?? provenance.guardedAbruptSuffixRecovery ?? provenance.guardedAbruptExitRecovery;
const booleanAssignments = proof.booleanLocalAssignments;
const terminalFrames = proof.terminalControlFrames || proof.terminalSwitchFrames;
const redundantGuards = proof.redundantExitGuards;
const terminalTails = proof.terminalLoopTails;
const fieldPredicates = proof.ownedFieldPredicates;
const grouping = proof.predicateGrouping;
const characterPredicates = proof.predicateNegations || grouping;
const switchPrefixes = proof.switchPrefixDispatches;
const nestedDispatch = proof.nestedDispatchRegions || switchPrefixes;
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
        if(args.length>2 && args[2].equals("grouping"))System.out.println("A\\t"+file+"\\t"+normalizedAst(unit));
        new TreePathScanner<Void,Void>() {
          @Override public Void visitBinary(BinaryTree tree,Void unused) {
            if(args.length>2 && args[2].equals("dispatch"))dispatchComparison(unit,trees,positions,file,getCurrentPath());
            if(args.length>1 && Arrays.asList(Tree.Kind.LESS_THAN,Tree.Kind.LESS_THAN_EQUAL,Tree.Kind.GREATER_THAN,Tree.Kind.GREATER_THAN_EQUAL).contains(tree.getKind())) {
              long leftEnd=positions.getEndPosition(unit,tree.getLeftOperand()),rightStart=positions.getStartPosition(unit,tree.getRightOperand());
              String op=source.substring((int)leftEnd,(int)rightStart).trim();
              if(!Arrays.asList("<","<=",">",">=").contains(op))throw new AssertionError("ambiguous relational operator");
              System.out.println("C\\t"+file+"\\t"+(leftEnd+source.substring((int)leftEnd,(int)rightStart).indexOf(op))+"\\t"+trees.getTypeMirror(new TreePath(getCurrentPath(),tree.getLeftOperand())).getKind()+"\\t"+trees.getTypeMirror(new TreePath(getCurrentPath(),tree.getRightOperand())).getKind());
            }
            return super.visitBinary(tree,unused);
          }
          @Override public Void visitIf(IfTree tree,Void unused) {
            if(args.length>2 && args[2].equals("booleans"))booleanAssignment(unit,trees,positions,file,tree);
            return super.visitIf(tree,unused);
          }
          void written(ExpressionTree expression) {
            if(args.length<3 || !args[2].equals("dispatch"))return;
            TreePath path=new TreePath(getCurrentPath(),expression);
            while(path.getLeaf() instanceof ParenthesizedTree)path=new TreePath(path,((ParenthesizedTree)path.getLeaf()).getExpression());
            javax.lang.model.element.Element variable=trees.getElement(path);
            if(path.getLeaf() instanceof IdentifierTree && variable!=null && variable.getKind()==javax.lang.model.element.ElementKind.LOCAL_VARIABLE && variable.asType().getKind()==javax.lang.model.type.TypeKind.INT) {
              Tree declaration=trees.getTree(variable);
              System.out.println("J\\t"+file+"\\t"+positions.getStartPosition(unit,path.getLeaf())+"\\t"+positions.getStartPosition(unit,declaration)+"\\t"+positions.getEndPosition(unit,declaration)+"\\t"+variable.getSimpleName());
            }
          }
          @Override public Void visitAssignment(AssignmentTree tree,Void unused){written(tree.getVariable());return super.visitAssignment(tree,unused);}
          @Override public Void visitCompoundAssignment(CompoundAssignmentTree tree,Void unused){written(tree.getVariable());return super.visitCompoundAssignment(tree,unused);}
          @Override public Void visitUnary(UnaryTree tree,Void unused){if(Arrays.asList(Tree.Kind.PREFIX_INCREMENT,Tree.Kind.PREFIX_DECREMENT,Tree.Kind.POSTFIX_INCREMENT,Tree.Kind.POSTFIX_DECREMENT).contains(tree.getKind()))written(tree.getExpression());return super.visitUnary(tree,unused);}
          @Override public Void visitClass(ClassTree tree,Void unused) {
            if(args.length>2 && args[2].equals("fields")) for(Tree member:tree.getMembers())if(member instanceof VariableTree) {
              VariableTree field=(VariableTree)member;
              System.out.println("W\\t"+file+"\\t"+tree.getSimpleName()+"\\t"+field.getName()+"\\t"+field.getType()+"\\t"+field.getModifiers().getFlags().contains(javax.lang.model.element.Modifier.STATIC));
            }
            for(Tree member:tree.getMembers())if(member instanceof BlockTree) {
              System.out.println(file+"\\t"+source.indexOf("{",(int)positions.getStartPosition(unit,member))+"\\t"+positions.getEndPosition(unit,member)+"\\t\\tinitializer");
              if(args.length>2 && (args[2].equals("tails") || args[2].equals("fields") || args[2].equals("grouping") || args[2].equals("dispatch") || args[2].equals("booleans")))verifyLoopTails(unit,positions,file,new TreePath(getCurrentPath(),member));
              else if(args.length>2 && args[2].equals("redundant"))verifyRedundantGuards(unit,trees,positions,file,new TreePath(getCurrentPath(),member));
              else if(args.length>2 && args[2].equals("terminal"))verifyTerminalTransfers(unit,positions,file,new TreePath(getCurrentPath(),member));
              else if(args.length>2)verifyGuards(unit,trees,positions,file,new TreePath(getCurrentPath(),member));
            }
            return super.visitClass(tree,unused);
          }
          @Override public Void visitMethod(MethodTree tree,Void unused) {
            if(tree.getBody()!=null && positions.getStartPosition(unit,tree.getBody())>=0 && positions.getEndPosition(unit,tree.getBody())>positions.getStartPosition(unit,tree.getBody())) { System.out.println(file+"\\t"+positions.getStartPosition(unit,tree.getBody())+"\\t"+positions.getEndPosition(unit,tree.getBody())+"\\t"+tree.getParameters().stream().map(p->p.getName().toString()).collect(Collectors.joining(","))+"\\t"+tree.getName()+"\\t"+tree.getParameters().stream().map(p->Base64.getEncoder().encodeToString(p.getType().toString().getBytes(StandardCharsets.UTF_8))).collect(Collectors.joining(","))+"\\t"+positions.getStartPosition(unit,tree)+"\\t"+enclosingClass(getCurrentPath()));
              if(args.length>2 && (args[2].equals("tails") || args[2].equals("fields") || args[2].equals("grouping") || args[2].equals("dispatch") || args[2].equals("booleans")))verifyLoopTails(unit,positions,file,new TreePath(getCurrentPath(),tree.getBody()));
              else if(args.length>2 && args[2].equals("redundant"))verifyRedundantGuards(unit,trees,positions,file,new TreePath(getCurrentPath(),tree.getBody()));
              else if(args.length>2 && args[2].equals("terminal"))verifyTerminalTransfers(unit,positions,file,new TreePath(getCurrentPath(),tree.getBody()));
              else if(args.length>2)verifyGuards(unit,trees,positions,file,new TreePath(getCurrentPath(),tree.getBody()));
            }
            return super.visitMethod(tree,unused);
          }
        }.scan(unit,null);
      }
    }
  }
  // Independent JDK attribution for removed classifier reads. Record exact
  // primitive-local declarations and literal constants, rather than trusting
  // the recovery parser's names or inferred types.
  static AssignmentTree booleanArm(StatementTree statement) {
    if(statement instanceof BlockTree) {List<? extends StatementTree> arms=((BlockTree)statement).getStatements();if(arms.size()!=1)return null;statement=arms.get(0);}
    if(!(statement instanceof ExpressionStatementTree))return null;
    ExpressionTree expression=((ExpressionStatementTree)statement).getExpression();
    if(!(expression instanceof AssignmentTree))return null;
    AssignmentTree assignment=(AssignmentTree)expression;
    return assignment.getVariable() instanceof IdentifierTree && assignment.getExpression().getKind()==Tree.Kind.BOOLEAN_LITERAL?assignment:null;
  }
  static void booleanAssignment(CompilationUnitTree unit,Trees trees,SourcePositions positions,String file,IfTree tree) {
    AssignmentTree yes=booleanArm(tree.getThenStatement()),no=booleanArm(tree.getElseStatement());if(yes==null||no==null)return;
    javax.lang.model.element.Element variable=trees.getElement(TreePath.getPath(unit,yes.getVariable())),other=trees.getElement(TreePath.getPath(unit,no.getVariable()));
    if(variable==null||!variable.equals(other)||variable.getKind()!=javax.lang.model.element.ElementKind.LOCAL_VARIABLE||variable.asType().getKind()!=javax.lang.model.type.TypeKind.BOOLEAN)return;
    Object a=((LiteralTree)yes.getExpression()).getValue(),b=((LiteralTree)no.getExpression()).getValue();if(a.equals(b))return;
    Tree declaration=trees.getTree(variable);
    String conditionType=trees.getTypeMirror(TreePath.getPath(unit,tree.getCondition())).toString();
    if(!conditionType.equals("boolean")&&!conditionType.equals("java.lang.Boolean"))throw new AssertionError("non Boolean if condition");
    System.out.println("V\\t"+file+"\\t"+positions.getStartPosition(unit,tree)+"\\t"+positions.getEndPosition(unit,tree)+"\\t"+positions.getStartPosition(unit,tree.getCondition())+"\\t"+positions.getEndPosition(unit,tree.getCondition())+"\\t"+positions.getStartPosition(unit,yes.getVariable())+"\\t"+positions.getStartPosition(unit,no.getVariable())+"\\t"+positions.getStartPosition(unit,declaration)+"\\t"+positions.getEndPosition(unit,declaration)+"\\tBOOLEAN\\t"+a+"\\t"+b+"\\t"+conditionType);
  }
  static void dispatchComparison(CompilationUnitTree unit,Trees trees,SourcePositions positions,String file,TreePath path) {
    BinaryTree binary=(BinaryTree)path.getLeaf();
    if(!Arrays.asList(Tree.Kind.EQUAL_TO,Tree.Kind.NOT_EQUAL_TO).contains(binary.getKind()))return;
    TreePath left=new TreePath(path,binary.getLeftOperand()),right=new TreePath(path,binary.getRightOperand());
    while(left.getLeaf() instanceof ParenthesizedTree)left=new TreePath(left,((ParenthesizedTree)left.getLeaf()).getExpression());
    while(right.getLeaf() instanceof ParenthesizedTree)right=new TreePath(right,((ParenthesizedTree)right.getLeaf()).getExpression());
    TreePath id=left.getLeaf() instanceof IdentifierTree?left:right,value=id==left?right:left;
    if(!(id.getLeaf() instanceof IdentifierTree))return;
    javax.lang.model.element.Element variable=trees.getElement(id);
    if(variable==null || variable.getKind()!=javax.lang.model.element.ElementKind.LOCAL_VARIABLE || variable.asType().getKind()!=javax.lang.model.type.TypeKind.INT || trees.getTypeMirror(value).getKind()!=javax.lang.model.type.TypeKind.INT)return;
    int sign=1;
    if(value.getLeaf() instanceof UnaryTree && Arrays.asList(Tree.Kind.UNARY_MINUS,Tree.Kind.UNARY_PLUS).contains(value.getLeaf().getKind())) {
      if(value.getLeaf().getKind()==Tree.Kind.UNARY_MINUS)sign=-1;value=new TreePath(value,((UnaryTree)value.getLeaf()).getExpression());
    }
    if(!(value.getLeaf() instanceof LiteralTree) || !(((LiteralTree)value.getLeaf()).getValue() instanceof Integer))return;
    long constant=sign*((Number)((LiteralTree)value.getLeaf()).getValue()).longValue();if(constant<Integer.MIN_VALUE || constant>Integer.MAX_VALUE)return;
    Tree declaration=trees.getTree(variable);
    System.out.println("I\\t"+file+"\\t"+positions.getStartPosition(unit,id.getLeaf())+"\\t"+positions.getEndPosition(unit,id.getLeaf())+"\\t"+variable.getSimpleName()+"\\t"+positions.getStartPosition(unit,declaration)+"\\t"+positions.getEndPosition(unit,declaration)+"\\tINT\\t"+constant+"\\t"+binary.getKind());
  }
  // Independent JDK structure fingerprint: ignore only parentheses. All
  // operators, literals, names, casts, association, child ordering and statement
  // structure survive. Ordinary binding audits separately prove resolution.
  static String normalizedAst(Tree root) {
    StringBuilder data=new StringBuilder();
    new TreeScanner<Void,StringBuilder>() {
      void atom(StringBuilder out,Object value) {String text=String.valueOf(value);out.append(text.length()).append(':').append(text);}
      @Override public Void scan(Tree tree,StringBuilder out) {
        if(tree==null){out.append("nil;");return null;}
        if(tree instanceof ParenthesizedTree)return scan(((ParenthesizedTree)tree).getExpression(),out);
        out.append('(');atom(out,tree.getKind());
        if(tree instanceof IdentifierTree)atom(out,((IdentifierTree)tree).getName());
        else if(tree instanceof MemberSelectTree)atom(out,((MemberSelectTree)tree).getIdentifier());
        else if(tree instanceof LiteralTree)atom(out,((LiteralTree)tree).getValue());
        else if(tree instanceof VariableTree)atom(out,((VariableTree)tree).getName());
        else if(tree instanceof MethodTree)atom(out,((MethodTree)tree).getName());
        else if(tree instanceof ClassTree)atom(out,((ClassTree)tree).getSimpleName());
        else if(tree instanceof LabeledStatementTree)atom(out,((LabeledStatementTree)tree).getLabel());
        else if(tree instanceof BreakTree)atom(out,((BreakTree)tree).getLabel());
        else if(tree instanceof ContinueTree)atom(out,((ContinueTree)tree).getLabel());
        else if(tree instanceof PrimitiveTypeTree)atom(out,((PrimitiveTypeTree)tree).getPrimitiveTypeKind());
        else if(tree instanceof ModifiersTree)atom(out,((ModifiersTree)tree).getFlags().stream().map(Object::toString).sorted().collect(Collectors.joining(",")));
        else if(tree instanceof MemberReferenceTree){atom(out,((MemberReferenceTree)tree).getMode());atom(out,((MemberReferenceTree)tree).getName());}
        super.scan(tree,out);out.append(')');return null;
      }
    }.scan(root,data);
    try {byte[] bytes=java.security.MessageDigest.getInstance("SHA-256").digest(data.toString().getBytes(StandardCharsets.UTF_8));StringBuilder hex=new StringBuilder();for(byte value:bytes)hex.append(String.format("%02x",value&255));return hex.toString();}
    catch(java.security.NoSuchAlgorithmException impossible){throw new AssertionError(impossible);}
  }
  static String enclosingClass(TreePath path) {
    for(TreePath p=path;p!=null;p=p.getParentPath())if(p.getLeaf() instanceof ClassTree)return ((ClassTree)p.getLeaf()).getSimpleName().toString();
    return "";
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
            Tree nearest=null;
            for(TreePath p=getCurrentPath().getParentPath();p!=null;p=p.getParentPath())if(loop(p.getLeaf()) || p.getLeaf() instanceof SwitchTree){nearest=p.getLeaf();break;}
            if(nearest instanceof SwitchTree) {
              TreePath p=getCurrentPath().getParentPath();while(p!=null && p.getLeaf()!=nearest)p=p.getParentPath();
              Tree child=nearest;p=p.getParentPath();boolean terminal=true;
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
              if(terminal && p!=null && child==target.getStatement())System.out.println("S\\t"+file+"\\t"+positions.getStartPosition(unit,tree)+"\\t"+positions.getEndPosition(unit,tree)+"\\t"+tree.getLabel()+"\\t"+positions.getStartPosition(unit,nearest));
            }
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
  // Resolve effects, primitive bindings and destinations independently using
  // attributed JDK trees. Guard chains may fall through other pure same-exit
  // guards; no actions, protected statements or value assumptions are skipped.
  static void verifyRedundantGuards(CompilationUnitTree unit,Trees trees,SourcePositions positions,String file,TreePath body) {
    Map<Tree,TreePath> paths=new IdentityHashMap<>();paths.put(body.getLeaf(),body);
    List<List<? extends StatementTree>> lists=new ArrayList<>();
    new TreePathScanner<Void,Void>() {
      @Override public Void scan(Tree tree,Void unused) {
        if(tree!=null && getCurrentPath()!=null)paths.put(tree,new TreePath(getCurrentPath(),tree));
        return super.scan(tree,unused);
      }
      @Override public Void visitBlock(BlockTree tree,Void unused) {lists.add(tree.getStatements());return super.visitBlock(tree,unused);}
      @Override public Void visitSwitch(SwitchTree tree,Void unused) {
        List<StatementTree> statements=new ArrayList<>();
        for(CaseTree clause:tree.getCases())if(clause.getStatements()!=null)statements.addAll(clause.getStatements());
        lists.add(statements);return super.visitSwitch(tree,unused);
      }
    }.scan(body,null);
    class Transfer {
      final StatementTree tree;final Tree target;final String label;
      Transfer(StatementTree tree,Tree target,String label){this.tree=tree;this.target=target;this.label=label;}
    }
    class Check {
      boolean loop(Tree tree){return Arrays.asList(Tree.Kind.WHILE_LOOP,Tree.Kind.DO_WHILE_LOOP,Tree.Kind.FOR_LOOP,Tree.Kind.ENHANCED_FOR_LOOP).contains(tree.getKind());}
      Transfer jump(StatementTree statement) {
        if(statement instanceof BlockTree){List<? extends StatementTree> ss=((BlockTree)statement).getStatements();return ss.size()==1?jump(ss.get(0)):null;}
        if(statement==null)return null;
        boolean isBreak=statement instanceof BreakTree,isContinue=statement instanceof ContinueTree;
        if(statement instanceof ReturnTree && ((ReturnTree)statement).getExpression()==null)return new Transfer(statement,body.getLeaf(),"");
        if(!isBreak && !isContinue)return null;
        javax.lang.model.element.Name name=isBreak?((BreakTree)statement).getLabel():((ContinueTree)statement).getLabel();
        TreePath path=paths.get(statement);if(path==null)return null;
        for(TreePath p=path.getParentPath();p!=null;p=p.getParentPath()){
          Tree parent=p.getLeaf();
          if(parent instanceof MethodTree || parent instanceof ClassTree || parent instanceof LambdaExpressionTree)return null;
          if(name!=null && parent instanceof LabeledStatementTree && ((LabeledStatementTree)parent).getLabel().contentEquals(name)){
            Tree target=isContinue?((LabeledStatementTree)parent).getStatement():parent;
            return !isContinue||loop(target)?new Transfer(statement,target,name.toString()):null;
          }
          if(name==null && (loop(parent)||isBreak && parent instanceof SwitchTree))return new Transfer(statement,parent,"");
        }
        return null;
      }
      boolean same(Transfer a,Transfer b){return a!=null && b!=null && a.tree.getKind()==b.tree.getKind() && a.target==b.target && a.label.equals(b.label);}
      boolean empty(StatementTree statement){return statement==null || statement instanceof EmptyStatementTree || statement instanceof BlockTree && ((BlockTree)statement).getStatements().isEmpty();}
      boolean pure(ExpressionTree expression,List<IdentifierTree> reads) {
        if(expression==null || !trees.getTypeMirror(paths.get(expression)).getKind().isPrimitive())return false;
        if(expression instanceof ParenthesizedTree)return pure(((ParenthesizedTree)expression).getExpression(),reads);
        if(expression instanceof IdentifierTree){javax.lang.model.element.Element element=trees.getElement(paths.get(expression));
          if(element==null || !Arrays.asList(javax.lang.model.element.ElementKind.LOCAL_VARIABLE,javax.lang.model.element.ElementKind.PARAMETER).contains(element.getKind()) || !element.asType().getKind().isPrimitive())return false;
          reads.add((IdentifierTree)expression);return true;
        }
        if(expression instanceof LiteralTree)return true;
        if(expression instanceof UnaryTree && Arrays.asList(Tree.Kind.UNARY_PLUS,Tree.Kind.UNARY_MINUS,Tree.Kind.BITWISE_COMPLEMENT,Tree.Kind.LOGICAL_COMPLEMENT).contains(expression.getKind()))return pure(((UnaryTree)expression).getExpression(),reads);
        if(expression instanceof BinaryTree && Arrays.asList(Tree.Kind.PLUS,Tree.Kind.MINUS,Tree.Kind.MULTIPLY,Tree.Kind.LEFT_SHIFT,Tree.Kind.RIGHT_SHIFT,Tree.Kind.UNSIGNED_RIGHT_SHIFT,Tree.Kind.AND,Tree.Kind.OR,Tree.Kind.XOR,Tree.Kind.CONDITIONAL_AND,Tree.Kind.CONDITIONAL_OR,Tree.Kind.EQUAL_TO,Tree.Kind.NOT_EQUAL_TO,Tree.Kind.LESS_THAN,Tree.Kind.LESS_THAN_EQUAL,Tree.Kind.GREATER_THAN,Tree.Kind.GREATER_THAN_EQUAL).contains(expression.getKind()))return pure(((BinaryTree)expression).getLeftOperand(),reads) && pure(((BinaryTree)expression).getRightOperand(),reads);
        return false;
      }
      boolean pureGuard(IfTree guard,List<IdentifierTree> reads){return trees.getTypeMirror(paths.get(guard.getCondition())).getKind()==javax.lang.model.type.TypeKind.BOOLEAN && pure(guard.getCondition(),reads);}
      boolean nextExit(List<? extends StatementTree> statements,int index,Transfer target,int depth) {
        if(index>=statements.size() || depth>128)return false;
        StatementTree next=statements.get(index);if(same(target,jump(next)))return true;
        if(!(next instanceof IfTree))return false;IfTree guard=(IfTree)next;
        if(!pureGuard(guard,new ArrayList<>()) || !same(target,jump(guard.getThenStatement())))return false;
        if(same(target,jump(guard.getElseStatement())))return true;
        return empty(guard.getElseStatement()) && nextExit(statements,index+1,target,depth+1);
      }
    }
    Check check=new Check();Set<Tree> selected=Collections.newSetFromMap(new IdentityHashMap<>());
    for(List<? extends StatementTree> statements:lists)for(int index=0;index<statements.size();index++){
      if(!(statements.get(index) instanceof IfTree))continue;IfTree guard=(IfTree)statements.get(index);
      Transfer yes=check.jump(guard.getThenStatement()),no=check.jump(guard.getElseStatement());List<IdentifierTree> reads=new ArrayList<>();
      if(yes==null || !check.pureGuard(guard,reads))continue;
      boolean both=check.same(yes,no);
      if(!both && !(check.empty(guard.getElseStatement()) && check.nextExit(statements,index+1,yes,0)) || !selected.add(guard))continue;
      long start=positions.getStartPosition(unit,guard);
      System.out.println("H\\t"+file+"\\t"+start+"\\t"+positions.getEndPosition(unit,guard)+"\\t"+positions.getStartPosition(unit,guard.getCondition())+"\\t"+positions.getEndPosition(unit,guard.getCondition())+"\\t"+yes.tree.getKind()+"\\t"+yes.label+"\\t"+both+"\\t"+positions.getStartPosition(unit,yes.tree)+"\\t"+positions.getEndPosition(unit,yes.tree));
      for(IdentifierTree read:reads){javax.lang.model.element.Element element=trees.getElement(paths.get(read));Tree declaration=trees.getTree(element);
        if(!(declaration instanceof VariableTree))throw new AssertionError("missing primitive declaration");
        System.out.println("V\\t"+file+"\\t"+start+"\\t"+positions.getStartPosition(unit,read)+"\\t"+positions.getEndPosition(unit,read)+"\\t"+element.getSimpleName()+"\\t"+element.asType().getKind()+"\\t"+positions.getStartPosition(unit,declaration)+"\\t"+positions.getEndPosition(unit,declaration));
      }
    }
  }
  // Independent JDK lexical evidence for terminal-tail permutations. A loop
  // contributes candidate boundaries only if its final bare break is its sole
  // own break and every own continue precedes that boundary. All transfers also
  // record exact targets and enclosing try/catch/finally/monitor identities.
  static void verifyLoopTails(CompilationUnitTree unit,SourcePositions positions,String file,TreePath body) {
    Map<Tree,TreePath> paths=new IdentityHashMap<>();paths.put(body.getLeaf(),body);
    List<Tree> transfers=new ArrayList<>();List<WhileLoopTree> loops=new ArrayList<>();
    new TreePathScanner<Void,Void>() {
      @Override public Void scan(Tree tree,Void unused){if(tree!=null && getCurrentPath()!=null)paths.put(tree,new TreePath(getCurrentPath(),tree));return super.scan(tree,unused);}
      @Override public Void visitClass(ClassTree tree,Void unused){return null;}
      @Override public Void visitLambdaExpression(LambdaExpressionTree tree,Void unused){return null;}
      @Override public Void visitWhileLoop(WhileLoopTree tree,Void unused){loops.add(tree);return super.visitWhileLoop(tree,unused);}
      @Override public Void visitBreak(BreakTree tree,Void unused){transfers.add(tree);return super.visitBreak(tree,unused);}
      @Override public Void visitContinue(ContinueTree tree,Void unused){transfers.add(tree);return super.visitContinue(tree,unused);}
      @Override public Void visitReturn(ReturnTree tree,Void unused){transfers.add(tree);return super.visitReturn(tree,unused);}
      @Override public Void visitThrow(ThrowTree tree,Void unused){transfers.add(tree);return super.visitThrow(tree,unused);}
    }.scan(body,null);
    class Check {
      boolean loop(Tree tree){return Arrays.asList(Tree.Kind.WHILE_LOOP,Tree.Kind.DO_WHILE_LOOP,Tree.Kind.FOR_LOOP,Tree.Kind.ENHANCED_FOR_LOOP).contains(tree.getKind());}
      String label(Tree tree){javax.lang.model.element.Name name=tree instanceof BreakTree?((BreakTree)tree).getLabel():tree instanceof ContinueTree?((ContinueTree)tree).getLabel():null;return name==null?"":name.toString();}
      Tree target(Tree tree){boolean isBreak=tree instanceof BreakTree,isContinue=tree instanceof ContinueTree;String label=label(tree);
        for(TreePath p=paths.get(tree).getParentPath();p!=null;p=p.getParentPath()){
          Tree parent=p.getLeaf();
          if(parent instanceof MethodTree)return isBreak||isContinue?null:parent;
          if(parent instanceof ClassTree || parent instanceof LambdaExpressionTree)break;
          if((isBreak||isContinue) && !label.isEmpty() && parent instanceof LabeledStatementTree && ((LabeledStatementTree)parent).getLabel().contentEquals(label))return parent;
          if((isBreak||isContinue) && label.isEmpty() && (loop(parent)||isBreak && parent instanceof SwitchTree))return parent;
        }
        return isBreak||isContinue?null:body.getLeaf();
      }
      String scopes(Tree tree){List<String> scopes=new ArrayList<>();Tree child=tree;
        for(TreePath p=paths.get(tree).getParentPath();p!=null;p=p.getParentPath()){
          Tree parent=p.getLeaf();
          if(parent instanceof TryTree){TryTree t=(TryTree)parent;String role=child==t.getBlock()?"BODY":child==t.getFinallyBlock()?"FINALLY":child instanceof CatchTree?"HANDLER":"RESOURCE";scopes.add("TRY:"+role+":"+positions.getStartPosition(unit,parent));}
          else if(parent instanceof CatchTree)scopes.add("CATCH:BODY:"+positions.getStartPosition(unit,parent));
          else if(parent instanceof SynchronizedTree)scopes.add("SYNCHRONIZED:BODY:"+positions.getStartPosition(unit,parent));
          if(parent instanceof MethodTree || parent instanceof ClassTree || parent instanceof LambdaExpressionTree)break;
          child=parent;
        }
        return String.join(",",scopes);
      }
      boolean literalTrue(ExpressionTree expression){while(expression instanceof ParenthesizedTree)expression=((ParenthesizedTree)expression).getExpression();return expression instanceof LiteralTree && Boolean.TRUE.equals(((LiteralTree)expression).getValue());}
    }
    Check check=new Check();Map<Tree,Tree> targets=new IdentityHashMap<>();
    for(Tree transfer:transfers){Tree target=check.target(transfer);if(target==null)throw new AssertionError("unresolved transfer");targets.put(transfer,target);
      System.out.println("Q\\t"+file+"\\t"+positions.getStartPosition(unit,transfer)+"\\t"+positions.getEndPosition(unit,transfer)+"\\t"+transfer.getKind()+"\\t"+check.label(transfer)+"\\t"+target.getKind()+"\\t"+positions.getStartPosition(unit,target)+"\\t"+positions.getEndPosition(unit,target)+"\\t"+check.scopes(transfer));
    }
    for(WhileLoopTree loop:loops){if(!check.literalTrue(loop.getCondition()) || !(loop.getStatement() instanceof BlockTree))continue;
      BlockTree block=(BlockTree)loop.getStatement();List<? extends StatementTree> statements=block.getStatements();if(statements.size()<3)continue;
      StatementTree exit=statements.get(statements.size()-1);if(!(exit instanceof BreakTree) || ((BreakTree)exit).getLabel()!=null || targets.get(exit)!=loop)continue;
      TreePath parent=paths.get(loop).getParentPath();LabeledStatementTree label=parent.getLeaf() instanceof LabeledStatementTree?(LabeledStatementTree)parent.getLeaf():null;
      Tree frame=label==null?loop:label;TreePath container=label==null?parent:parent.getParentPath();
      List<Tree> own=transfers.stream().filter(tree->targets.get(tree)==loop || label!=null && targets.get(tree)==label).collect(Collectors.toList());
      for(int boundary=1;boundary<statements.size()-1;boundary++){
        long prefixStart=positions.getStartPosition(unit,statements.get(0)),suffixStart=positions.getStartPosition(unit,statements.get(boundary));
        boolean valid=true,backedge=false,tailScope=false;
        for(int index=0;index<boundary;index++)if(statements.get(index) instanceof VariableTree || statements.get(index) instanceof ClassTree)valid=false;
        for(int index=boundary;index<statements.size()-1;index++)if(statements.get(index) instanceof VariableTree)tailScope=true;
        for(Tree transfer:own)if(transfer!=exit){long start=positions.getStartPosition(unit,transfer);if(!(transfer instanceof ContinueTree) || start<prefixStart || start>=suffixStart)valid=false;else backedge=true;}
        if(valid && backedge)System.out.println("Y\\t"+file+"\\t"+positions.getStartPosition(unit,frame)+"\\t"+positions.getEndPosition(unit,loop)+"\\t"+positions.getStartPosition(unit,loop)+"\\t"+(positions.getStartPosition(unit,block)+1)+"\\t"+prefixStart+"\\t"+suffixStart+"\\t"+positions.getStartPosition(unit,exit)+"\\t"+positions.getEndPosition(unit,exit)+"\\t"+(positions.getEndPosition(unit,block)-1)+"\\t"+tailScope+"\\t"+!(container.getLeaf() instanceof BlockTree)+"\\t"+(label==null?"":label.getLabel()));
      }
    }
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
    ...((proof.integralPredicates || proof.dominatedPredicates || terminalFrames || redundantGuards || terminalTails || fieldPredicates || grouping || nestedDispatch || booleanAssignments) ? [path.join(repository, 'readable/funorb-stubs.jar')] : []), ...(booleanAssignments ? ['booleans'] : nestedDispatch ? ['dispatch'] : grouping ? ['grouping'] : fieldPredicates ? ['fields'] : terminalTails ? ['tails'] : redundantGuards ? ['redundant'] : terminalFrames ? ['terminal'] : proof.dominatedPredicates ? ['dominated'] : [])]).toString().trim().split('\n').map(line => line.split('\t'));
  const ownedFieldEvidence = new Map(beforeFiles.map(entry => {
    const owner = entry.path.slice(0, -5);
    const fields = positionRows.filter(row => row[0] === 'W' && row[1] === entry.path && row[2] === owner);
    return [entry.path, {owner, fields: fields.map(row => ({name: row[3], type: row[4], static: row[5] === 'true'}))}];
  }));
  const integralEvidence = new Map(positionRows.filter(row => row[0] === 'C').map(row => [row[1] + ':' + row[2], row.slice(3)]));
  const guardEvidence = new Map(positionRows.filter(row => row[0] === 'G').map(row => [row[1] + ':' + row[2] + ':' + row[3], row.slice(4)]));
  const terminalEvidence = new Map(positionRows.filter(row => ['E', 'U', 'F', 'S'].includes(row[0])).map(row => [row[0] + ':' + row[1] + ':' + row[2], row]));
  const redundantEvidence = new Map(positionRows.filter(row => row[0] === 'H').map(row => [row[1] + ':' + row[2], row]));
  const redundantReads = positionRows.filter(row => row[0] === 'V');
  const tailEvidence = new Map(positionRows.filter(row => row[0] === 'Y').map(row => [row[1] + ':' + row[2] + ':' + row[7], row]));
  const oldTransferEvidence = positionRows.filter(row => row[0] === 'Q');
  const dispatchReads = new Map(positionRows.filter(row => row[0] === 'I').map(row => [row[1] + ':' + row[2], row]));
  const dispatchWrites = positionRows.filter(row => row[0] === 'J');
  const spans = positionRows.filter(row => !['C', 'G', 'E', 'U', 'F', 'S', 'H', 'V', 'Q', 'Y', 'W', 'A', 'I', 'J'].includes(row[0])).map(([file, start, end, parameters, method, types, methodStart, owner]) => {
    const parameterNames = (parameters || '').split(',').filter(Boolean);
    const parameterTypes = (types || '').split(',').filter(Boolean).map(type => Buffer.from(type, 'base64').toString('utf8'));
    assert.equal(parameterNames.length, parameterTypes.length, 'all formal parameter types');
    return {file, owner: owner || file.slice(0, -5), start: Number(start), end: Number(end), methodStart: Number(methodStart), parameterNames,
      parameters: parameterNames.map((name, index) => ({name, type: parameterTypes[index]}))};
  });
  const require = createRequire(import.meta.url);
  const {recoverPostGuardExits, foldGuardedAbruptPlainBlockExits, foldGuardedLoopContinuations, foldNonrepeatingWhileLoops, foldTrailingLoopContinuations, foldLoopExitContinuations, foldTerminalLoopExits, foldNonlocalLoopExits, foldLoopElseExitGuards, recoverScalarIfDispatches, simplifyPredicateNegations, simplifyDominatedPredicates, finalizeControlFrames, finalizeTerminalSwitchFrames, foldRedundantExitGuards, foldTerminalLoopTails, simplifyPredicateGrouping, foldScalarSwitchPrefixes, foldBooleanLocalAssignments} = require(path.join(tools.directory, 'src/decompiler/javaAstEmitter.js'));
  const {tokenizeJava} = require(path.join(tools.directory, 'src/java-frontend/lexer.js'));
  const tokens = source => tokenizeJava(source).tokens.filter(t => !['whitespace', 'eof'].includes(t.kind)).map(t => t.text);
  const lexical = source => tokenizeJava(source).tokens.filter(t => !['whitespace', 'eof'].includes(t.kind));
  const originOrders = new Map(), originLocations = new Map(), changedFiles = new Set(), removedGuardRanges = new Map();
  const bareBreaks = source => { const text = tokens(source); return text.filter((token, index) => token === 'break' && text[index + 1] === ';').length; };
  const counts = {}, sharedSelections = [], trailingSelections = [], tailSelections = [], fieldPredicateSelections = [], groupingSelections = [], dispatchSelections = [];
  let independentlyAttributedClassifierReads = 0;
  const switchSelectorOrigins = [];
  const booleanAssignmentSelections = [], booleanAssignmentsProven = [];
  const booleanFacts = new Map(positionRows.filter(row => row[0] === 'V').map(row => [row[1] + ':' + row[2], row]));
  let methods = 0, files = 0, linesBefore = 0, linesAfter = 0, labelsBefore = 0, labelsAfter = 0;
  let bareBreaksBefore = 0, bareBreaksAfter = 0;
  for (const entry of beforeFiles) {
    const original = fs.readFileSync(path.join(before, entry.path), 'utf8');
    const actual = fs.readFileSync(path.join(after, entry.path), 'utf8');
    const edits = [];
    for (const span of spans.filter(s => s.file === entry.path)) {
      if ((fieldPredicates || grouping || nestedDispatch || booleanAssignments) && span.owner !== entry.path.slice(0, -5)) continue;
      const body = original.slice(span.start + 1, span.end - 1);
      const recover = source => {
        if (booleanAssignments) {
          const result = foldBooleanLocalAssignments(source, {retainDiagnostics: true});
          if (!result.assignmentsFolded) return {source, rewrites: 0};
          const oldTokens = lexical(source), mappedTokens = [], base = span.start + 1;
          const slice = range => oldTokens.filter(token => token.range.startOffset >= range.start && token.range.endOffset <= range.end)
            .map(token => ({text: token.text, origin: token.range.startOffset}));
          const generated = values => values.map(text => ({text, origin: null}));
          let cursor = 0;
          for (const d of result.diagnostics.assignments) {
            const fact = booleanFacts.get(entry.path + ':' + (base + d.range.start));
            assert.ok(fact, 'independent JDK proves opposite literals store the same primitive Boolean local');
            assert.equal(Number(fact[3]), base + d.range.end); assert.equal(Number(fact[4]), base + d.conditionRange.start); assert.equal(Number(fact[5]), base + d.conditionRange.end);
            assert.equal(Number(fact[6]), base + d.nameRange.start); assert.equal(Number(fact[7]), base + d.discardedNameRange.start);
            assert.equal(fact[10], 'BOOLEAN'); assert.equal(fact[11], d.inverted ? 'false' : 'true'); assert.equal(fact[12], d.inverted ? 'true' : 'false');
            assert.ok(['boolean', 'java.lang.Boolean'].includes(fact[13]));
            booleanAssignmentsProven.push({file: entry.path, fact, name: d.variable});
            mappedTokens.push(...slice({start: cursor, end: d.range.start}), ...slice(d.nameRange), ...generated(['=', ...(d.inverted ? ['!'] : [])]), ...slice(d.conditionRange), ...generated([';']));
            cursor = d.range.end;
          }
          mappedTokens.push(...slice({start: cursor, end: source.length}));
          assert.deepEqual(mappedTokens.map(token => token.text), tokens(result.source), 'independent single local store and unchanged condition token permutation');
          assert.equal(foldBooleanLocalAssignments(result.source).assignmentsFolded, 0);
          return {source: result.source, rewrites: result.assignmentsFolded, mappedTokens, counts: {booleanLocalAssignments: result.assignmentsFolded, negatedAssignments: result.negatedAssignments, branchBlocksRemoved: result.blocksRemoved, duplicateLocalWritesRemoved: result.assignmentsFolded}};
        }
        if (grouping) {
          const result = simplifyPredicateGrouping(source, {retainDiagnostics: true});
          if (!result.parenthesisPairsRemoved) return {source, rewrites: 0};
          let expected = source, mappedCharacters = Array.from({length: source.length}, (_, index) => index);
          const d = result.diagnostics, removed = new Set(d.deletedRanges.map(range => range.start));
          assert.equal(d.deletedRanges.length, result.parenthesisPairsRemoved * 2);
          assert.deepEqual(removed, new Set(d.pairs.flatMap(pair => [pair.open, pair.close])), 'only complete matched grouping pairs disappear');
          for (const pair of d.pairs) {assert.equal(source[pair.open], '(');assert.equal(source[pair.close], ')');assert.ok(pair.open < pair.close);}
          for (const range of d.deletedRanges.slice().reverse()) {
            assert.equal(range.end - range.start, 1);assert.ok(['(', ')'].includes(source[range.start]));
            expected = expected.slice(0, range.start) + expected.slice(range.end);mappedCharacters.splice(range.start, 1);
          }
          assert.equal(result.source, expected, 'exact original parentheses deletions');
          assert.deepEqual(tokens(result.source), lexical(source).filter(token => !removed.has(token.range.startOffset)).map(token => token.text),
            'every other token including operators, operands, casts, literals and transfers remains ordered');
          return {source: result.source, rewrites: result.conditionsSimplified, mappedCharacters,
            counts: {conditionsSimplified: result.conditionsSimplified, parenthesisPairsRemoved: result.parenthesisPairsRemoved}};
        }
        if (terminalTails) {
          let tails = 0, tailLines = 0, mappedTokens = lexical(source).map(token => ({text: token.text, origin: token.range.startOffset}));
          for (;;) {
            const result = foldTerminalLoopTails(source, {parameterNames: span.parameterNames, retainDiagnostics: true});
            if (!result.tailsHoisted) break;
            const oldTokens = lexical(source), d = result.diagnostics;
            const slice = range => mappedTokens.filter((_, index) => oldTokens[index].range.startOffset >= range.start && oldTokens[index].range.endOffset <= range.end);
            const origin = offset => {const index = oldTokens.findIndex(token => token.range.startOffset === offset);assert.ok(index >= 0);return span.start + 1 + mappedTokens[index].origin;};
            const evidence = tailEvidence.get(entry.path + ':' + origin(d.loopRange.start) + ':' + origin(d.suffixRange.start));
            assert.ok(evidence, 'independent JDK proves sole final own break, prefix-only backedges and declaration scopes');
            assert.equal(Number(evidence[3]), origin(d.closingBraceRange.start) + 1);
            assert.equal(Number(evidence[5]), origin(d.headerRange.end - 1) + 1);
            assert.equal(Number(evidence[6]), origin(d.prefixRange.start)); assert.equal(Number(evidence[8]), origin(d.exitRange.start));
            assert.equal(Number(evidence[9]), origin(d.exitRange.end - 1) + 1); assert.equal(Number(evidence[10]), origin(d.closingBraceRange.start));
            assert.equal(evidence[11], String(d.retainedTailScope)); assert.equal(evidence[12], String(d.scalarParentWrapped)); assert.equal(evidence[13], d.label || '');
            const generated = values => values.map(text => ({text, origin: null}));
            // Every original token retains its identity. Only wrapper braces
            // may be generated; no predicate, action or transfer is duplicated.
            mappedTokens = [...slice({start: 0, end: d.loopRange.start}), ...generated(d.scalarParentWrapped ? ['{'] : []),
              ...slice(d.headerRange), ...slice(d.prefixRange), ...slice(d.exitRange), ...slice(d.closingBraceRange),
              ...generated(d.retainedTailScope ? ['{'] : []), ...slice(d.suffixRange), ...generated(d.retainedTailScope ? ['}'] : []),
              ...generated(d.scalarParentWrapped ? ['}'] : []), ...slice({start: d.loopRange.end, end: source.length})];
            assert.deepEqual(mappedTokens.map(token => token.text), tokens(result.source), 'complete independent header/prefix/original-exit/close/tail permutation');
            tailLines += source.slice(d.suffixRange.start, d.suffixRange.end).trim().split('\n').length;
            source = result.source; tails += result.tailsHoisted;
          }
          return {source, rewrites: tails, mappedTokens, tailLines, counts: {tailsHoisted: tails}};
        }
        if (redundantGuards) {
          let guards = 0, mappedCharacters = Array.from({length: source.length}, (_, index) => index);
          for (;;) {
            const result = foldRedundantExitGuards(source, {parameters: span.parameters, retainDiagnostics: true});
            if (!result.guardsRemoved) break;
            const allowed = [];
            for (const guard of result.diagnostics.removedGuards) {
              const start = span.start + 1 + mappedCharacters[guard.start];
              const evidence = redundantEvidence.get(entry.path + ':' + start);
              assert.ok(evidence, 'independent JDK proves effect-free primitive guard and exact identical exit targets');
              assert.equal(Number(evidence[3]), span.start + 2 + mappedCharacters[guard.end - 1]);
              assert.equal(evidence[6], {BreakStatement: 'BREAK', ContinueStatement: 'CONTINUE', ReturnStatement: 'RETURN'}[guard.exitKind]);
              assert.equal(evidence[7], guard.exitLabel || ''); assert.equal(evidence[8], String(guard.bothArms));
              // JDK condition ranges include grouping. Its read ranges provide
              // an independent binding check for every removed condition token.
              const retainedStart = Number(evidence[9]), retainedEnd = Number(evidence[10]);
              allowed.push({start, end: Number(evidence[3]), retainedStart: guard.bothArms ? retainedStart : null,
                retainedEnd: guard.bothArms ? retainedEnd : null});
              if (!removedGuardRanges.has(entry.path)) removedGuardRanges.set(entry.path, []);
              removedGuardRanges.get(entry.path).push({start, end: Number(evidence[3]), conditionStart: Number(evidence[4]),
                conditionEnd: Number(evidence[5]), reads: redundantReads.filter(row => row[1] === entry.path && Number(row[2]) === start)});
            }
            let expected = source;
            for (const edit of result.diagnostics.deletedRanges.slice().reverse()) {
              assert.ok(edit.start >= 0 && edit.start < edit.end && edit.end <= source.length);
              for (let index = edit.start; index < edit.end; index++) {
                const origin = span.start + 1 + mappedCharacters[index];
                assert.ok(allowed.some(range => origin >= range.start && origin < range.end
                  && !(range.retainedStart !== null && origin >= range.retainedStart && origin < range.retainedEnd))
                  || /\s/.test(source[index]), 'every deleted non-whitespace character belongs to an independently proven redundant guard');
              }
              expected = expected.slice(0, edit.start) + expected.slice(edit.end); mappedCharacters.splice(edit.start, edit.end - edit.start);
            }
            assert.equal(result.source, expected, 'only exact original character deletions');
            source = result.source; guards += result.guardsRemoved;
          }
          return {source, rewrites: guards, mappedCharacters, counts: {guardsRemoved: guards}};
        }
        if (terminalFrames) {
          const result = proof.terminalSwitchFrames ? finalizeTerminalSwitchFrames(source) : finalizeControlFrames(source);
          const exitCount = proof.terminalSwitchFrames ? 'breaksLocalized' : 'breaksRemoved';
          const totals = Object.fromEntries([exitCount, 'labelsRemoved', 'jumpsUnlabeled', 'blocksUnwrapped'].map(key => [key, result[key]]));
          if (!result[exitCount]) return {source, rewrites: 0, counts: totals};
          assert.ok(!/\\u/.test(source), 'changed body uses direct source offsets');
          const old = lexical(source), next = lexical(result.source);
          const definitions = text => new Set(text.filter((token, index) => token.kind === 'identifier' && text[index + 1]?.text === ':').map(token => token.text));
          const retainedLabels = definitions(next), removedLabels = new Set([...definitions(old)].filter(name => !retainedLabels.has(name)));
          assert.equal(removedLabels.size, result.labelsRemoved);
          const deleted = new Set(), checked = Object.fromEntries(Object.keys(totals).map(key => [key, 0]));
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
            if (proof.terminalSwitchFrames && token.text === 'break') {
              const fact = evidence('S', token);
              if (fact && fact[4] === old[index + 1]?.text) {
                assert.equal(old[index + 2]?.text, ';');
                assert.equal(Number(fact[3]), span.start + 1 + old[index + 2].range.endOffset);
                deleted.add(index + 1); checked.breaksLocalized++;
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
              assert.ok(!proof.terminalSwitchFrames, 'switch destination rewrites cannot delete complete breaks');
              const fact = token.text === 'break' && evidence('E', token);
              assert.ok(fact && fact[4] === old[index + 1]?.text && old[index + 2]?.text === ';', 'only independently proven terminal breaks can disappear');
              assert.equal(Number(fact[3]), span.start + 1 + old[index + 2].range.endOffset);
              checked.breaksRemoved++; index += 2; continue;
            }
            mappedTokens.push({text: token.text, origin: token.range.startOffset}); cursor++;
          }
          assert.equal(cursor, next.length, 'no tokens can be inserted or reordered');
          assert.deepEqual(checked, totals, 'all deletions have independent JDK structural evidence');
          return {source: result.source, rewrites: result[exitCount], mappedTokens, counts: totals};
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
            const result = simplifyPredicateNegations(source, {retainDiagnostics: true, ...(proof.integralPredicates ? {parameters: span.parameters, ...(fieldPredicates ? {ownedFields: ownedFieldEvidence.get(entry.path)} : {})} : {})});
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
          let dispatches = 0, comparisonsRemoved = 0, switchExitsAdded = 0, blocksUnwrapped = 0;
          let mappedTokens = lexical(source).map(token => ({text: token.text, origin: token.range.startOffset}));
          for (;;) {
            const result = switchPrefixes ? foldScalarSwitchPrefixes(source, {retainDiagnostics: true})
              : recoverScalarIfDispatches(source, {retainDiagnostics: true, nestedRegions: Boolean(nestedDispatch)});
            if (!(switchPrefixes ? result.switchesExtended : result.dispatchesRecovered)) break;
            const oldTokens = lexical(source), d = result.diagnostics;
            const slice = range => mappedTokens.filter((_, index) => oldTokens[index].range.startOffset >= range.start
              && oldTokens[index].range.endOffset <= range.end);
            const generated = values => values.flatMap(text => lexical(text).map(token => ({text: token.text, origin: null})));
            const selector = slice({start: d.selectorOrigin, end: d.selectorOrigin + d.selector.length});
            assert.deepEqual(selector.map(token => token.text), [d.selector]);
            const attributedValues = [];
            for (const condition of d.conditionRanges) {
              const identifiers = slice(condition).filter(token => token.text === d.selector);
              assert.equal(identifiers.length, 1, 'each removed classifier compares exactly one primitive local read');
              if (nestedDispatch) {
                assert.notEqual(identifiers[0].origin, null, 'original classifier occurrence');
                const absolute = span.start + 1 + identifiers[0].origin;
                const fact = dispatchReads.get(entry.path + ':' + absolute);
                assert.ok(fact, 'JDK attributes each classifier read to a primitive int local and literal');
                assert.equal(fact[4], d.selector); assert.equal(fact[7], 'INT');
                const firstComparison = slice(d.conditionRanges[0]).find(token => token.text === d.selector);
                const suffixStart = span.start + 1 + (switchPrefixes ? firstComparison.origin : selector[0].origin);
                if (switchPrefixes) assert.equal(fact[9], 'EQUAL_TO', 'JDK proves each actual prefix is an equality arm');
                const lastOriginal = slice(d.regionRange).filter(token => token.origin !== null).at(-1);
                assert.ok(lastOriginal);
                const suffixEnd = span.start + 1 + lastOriginal.origin + lastOriginal.text.length;
                assert.ok(!dispatchWrites.some(write => write[1] === entry.path && write[3] === fact[5]
                  && Number(write[2]) >= suffixStart && Number(write[2]) < suffixEnd), 'JDK proves the captured local has no suffix assignment/increment');
                attributedValues.push(Number(fact[8])); independentlyAttributedClassifierReads++;
              }
            }
            if (nestedDispatch) assert.deepEqual([...new Set(d.actions.flatMap(action => action.cases).concat(d.emptyCases || []))].sort((a,b)=>a-b),
              [...new Set(attributedValues)].sort((a,b)=>a-b), 'every independently attributed int constant is represented exactly once');
            const clauses = d.actions.flatMap(action => [
              ...action.cases.flatMap(value => generated(['case', String(value), ':'])),
              ...generated(action.default ? ['default', ':'] : []), ...slice(action.range),
              ...generated(action.exitAdded ? ['break', ';'] : [])]);
            const empty = [...(d.emptyCases || []).flatMap(value => generated(['case', String(value), ':'])),
              ...generated(d.emptyDefault ? ['default', ':'] : []),
              ...generated((d.emptyCases || []).length || d.emptyDefault ? ['break', ';'] : [])];
            // Keep the selector computation, every action and every existing
            // flag/transfer token; replace only pure integer comparisons. The
            // new switch retains the first comparison read; an extended switch
            // retains its original selector read and header, moved together.
            if (switchPrefixes) {
              const firstRead = slice(d.conditionRanges[0]).find(token => token.text === d.selector);
              switchSelectorOrigins.push({file: entry.path, selector: span.start + 1 + selector[0].origin, comparison: span.start + 1 + firstRead.origin});
            }
            mappedTokens = switchPrefixes
              ? [...slice({start: 0, end: d.regionRange.start}), ...slice(d.headerRange), ...clauses, ...slice(d.tailRange), ...slice({start: d.regionRange.end, end: source.length})]
              : [...slice({start: 0, end: d.regionRange.start}), ...slice(d.prefixRange),
              ...generated(['switch', '(']), ...selector, ...generated([')', '{']), ...clauses, ...empty,
              ...generated(['}']), ...slice({start: d.regionRange.end, end: source.length})];
            assert.deepEqual(mappedTokens.map(token => token.text), tokens(result.source), 'independent prefix/selector/ordered-actions switch permutation');
            source = result.source; dispatches++; comparisonsRemoved += d.conditionRanges.length;
            blocksUnwrapped += result.blocksUnwrapped || 0;
            switchExitsAdded += d.actions.filter(action => action.exitAdded).length + Number(Boolean((d.emptyCases || []).length || d.emptyDefault));
          }
          return {source, rewrites: dispatches, mappedTokens, counts: {...(switchPrefixes ? {scalarSwitchPrefixes: dispatches, blocksUnwrapped} : {scalarIfDispatches: dispatches}), primitiveComparisonsRemoved: comparisonsRemoved, bareSwitchExitsAdded: switchExitsAdded}};
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
      if (nestedDispatch) dispatchSelections.push({...span, ...result.counts});
      if (booleanAssignments) booleanAssignmentSelections.push({...span, ...result.counts});
      if (grouping) groupingSelections.push({...span, ...result.counts});
      if (fieldPredicates) fieldPredicateSelections.push({...span, comparisons: result.counts.relationalComplements});
      if (terminalTails) tailSelections.push({...span, tailLines: result.tailLines});
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
      if (proof.loopElseExitGuards || proof.terminalPrefixBreaks || proof.scalarIfDispatches || terminalFrames || terminalTails || booleanAssignments) assert.ok(!/\\u/.test(original), 'changed file has direct source/token offsets');
    }
    if (characterPredicates || proof.dominatedPredicates || redundantGuards) {
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
    if (proof.nonlocalLoopExits || proof.loopElseExitGuards || proof.terminalPrefixBreaks || proof.scalarIfDispatches || terminalFrames || terminalTails || booleanAssignments) {
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
        if (nestedDispatch || booleanAssignments) locations.set(token.origin + token.text.length - 1, actualTokens[index].range.endOffset - 1);
      });
      originOrders.set(entry.path, order);
      originLocations.set(entry.path, locations);
    }
    let expected = original;
    for (const edit of edits.reverse()) expected = expected.slice(0, edit.start + 1) + edit.source + expected.slice(edit.end - 1);
    assert.deepEqual(tokens(actual), tokens(expected), entry.path + ' complete expected token stream');
    if (characterPredicates || proof.dominatedPredicates || redundantGuards || terminalFrames || terminalTails || nestedDispatch || booleanAssignments) assert.equal(actual, expected, entry.path + ' exact expected source bytes');
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
  const removedBooleanWrites = new Set(), booleanDestinationSymbols = new Set();
  if (booleanAssignments) for (const {file, fact, name} of booleanAssignmentsProven) {
    const declarations = oldAudit.filter(row => row[0] === 'D' && row[1] === file && row[5] === name && Number(row[2]) >= Number(fact[8]) && Number(row[3]) <= Number(fact[9]));
    assert.equal(declarations.length, 1, 'unique independently attributed primitive-local declaration');
    booleanDestinationSymbols.add(declarations[0][4]);
    for (const offset of [fact[6], fact[7]]) {
      const references = oldAudit.filter(row => row[0] === 'R' && row[1] === file && row[2] === offset);
      assert.equal(references.length, 1); assert.equal(references[0][4], declarations[0][4]); assert.equal(references[0][5], name);
    }
    const key = file + ':' + fact[7]; assert.ok(!removedBooleanWrites.has(key)); removedBooleanWrites.add(key);
  }
  if (booleanAssignments) {
    assert.equal(removedBooleanWrites.size, proof.duplicateLocalWriteOccurrencesRemoved);
    assert.deepEqual([...booleanDestinationSymbols].sort(), proof.booleanDestinationSymbols, 'every exact JVM-local destination identity independently reverified');
  }
  for (const origin of switchSelectorOrigins) {
    const selector = oldAudit.filter(row => row[0] === 'R' && row[1] === origin.file && Number(row[2]) === origin.selector);
    const comparison = oldAudit.filter(row => row[0] === 'R' && row[1] === origin.file && Number(row[2]) === origin.comparison);
    assert.equal(selector.length, 1); assert.equal(comparison.length, 1);
    assert.equal(selector[0][4], comparison[0][4], 'moved switch read independently resolves to the same attributed primitive local');
  }
  if (nestedDispatch) {
    // Actual changed encoders, independently checked against the JDK charset
    // one UTF-16 code unit at a time (the game treats surrogate halves singly).
    const encoder = path.join(temporary, 'DispatchEncodingProbe.java');
    fs.writeFileSync(encoder, `import java.util.*;
public class DispatchEncodingProbe {
  public static void main(String[]args)throws Exception {
    char[] units=new char[65536];byte[] wanted=new byte[65536];
    for(int i=0;i<units.length;i++){units[i]=(char)i;byte[] encoded=String.valueOf(units[i]).getBytes("windows-1252");if(encoded.length!=1)throw new AssertionError("single unit charset width");wanted[i]=i==0?(byte)63:encoded[0];}
    String source=new String(units);int cases=0;
    for(int flag:new int[]{-1,0,1}) {
      Geoblox.field_C=flag;byte[] slice=new byte[65550];Arrays.fill(slice,(byte)42);
      int count=hi.a(source,slice,0,source.length(),7,98);if(count!=source.length())throw new AssertionError("encoded slice length");
      if(!Arrays.equals(Arrays.copyOfRange(slice,7,7+count),wanted))throw new AssertionError("slice charset oracle");
      for(int i=0;i<slice.length;i++)if((i<7||i>=7+count)&&slice[i]!=42)throw new AssertionError("slice padding");
      if(!Arrays.equals(jf.a(source,(byte)127),wanted))throw new AssertionError("array charset oracle");
      if(Geoblox.field_C!=flag)throw new AssertionError("control flag mutation");cases+=2*65536;
    }
    System.out.println(cases+" independent encoded UTF-16 units");
  }
}`);
    run('javac', ['--release', '8', '-cp', path.join(temporary, 'old-classes') + path.delimiter + stubs, '-d', helpers, encoder]);
    for (const name of ['old', 'new']) assert.equal(run('java', ['-Djava.awt.headless=true', '-cp', helpers + path.delimiter + path.join(temporary, name + '-classes') + path.delimiter + stubs, 'DispatchEncodingProbe']).toString().trim(),
      '393216 independent encoded UTF-16 units', name + ' changed encoders preserve the complete charset domain');
  }
  const removedGuardReads = new Set();
  if (redundantGuards) {
    for (const [file, guards] of removedGuardRanges) for (const guard of guards) {
      const references = oldAudit.filter(row => row[0] === 'R' && row[1] === file && Number(row[2]) >= guard.conditionStart && Number(row[3]) <= guard.conditionEnd);
      assert.deepEqual(references.map(row => [Number(row[2]), Number(row[3]), row[5]]), guard.reads.map(row => [Number(row[3]), Number(row[4]), row[5]]), 'every removed guard read is independently attributed primitive local/parameter access');
      for (let index = 0; index < references.length; index++) {
        const row = references[index], fact = guard.reads[index];
        assert.ok(['BOOLEAN', 'BYTE', 'SHORT', 'CHAR', 'INT', 'LONG', 'FLOAT', 'DOUBLE'].includes(fact[6]));
        const declarations = oldAudit.filter(d => d[0] === 'D' && d[1] === file && d[5] === row[5] && Number(d[2]) >= Number(fact[7]) && Number(d[3]) <= Number(fact[8]));
        assert.equal(declarations.length, 1); assert.equal(row[4], declarations[0][4]);
        const key = file + ':' + row[2]; assert.ok(!removedGuardReads.has(key)); removedGuardReads.add(key);
      }
    }
    assert.equal(removedGuardReads.size, proof.primitiveReferenceOccurrencesRemoved);
  }
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
    if (booleanAssignments) {
      for (const row of oldAudit.filter(row => row[0] === kind && changedFiles.has(row[1])))
        assert.equal(!originLocations.get(row[1]).has(Number(row[2])), kind === 'R' && removedBooleanWrites.has(row[1] + ':' + row[2]), 'only the independently attributed duplicate local stores disappear');
      const positioned = (row, transform) => {
        const start = transform ? originLocations.get(row[1]).get(Number(row[2])) : Number(row[2]);
        assert.notEqual(start, undefined, 'every surviving ordinary binding has one exact token origin');
        return [row[1], start, start + Number(row[3]) - Number(row[2]), row[4], row[5]];
      };
      const ordered = rows => rows.sort((a,b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]);
      assert.deepEqual(ordered(newAudit.filter(row => row[0] === kind).map(row => positioned(row, false))),
        ordered(oldAudit.filter(row => row[0] === kind && !(kind === 'R' && removedBooleanWrites.has(row[1] + ':' + row[2]))).map(row => positioned(row, changedFiles.has(row[1])))), 'all retained declarations, condition references and local store bindings follow the independent token map');
    } else if (terminalFrames || terminalTails) {

      const positioned = (row, transform) => {
        const start = transform ? originLocations.get(row[1]).get(Number(row[2])) : Number(row[2]);
        assert.notEqual(start, undefined, 'every ordinary binding token survives exactly once');
        return [row[1], start, start + Number(row[3]) - Number(row[2]), row[4], row[5]];
      };
      assert.deepEqual(newAudit.filter(row => row[0] === kind).map(row => positioned(row, false)),
        oldAudit.filter(row => row[0] === kind).map(row => positioned(row, changedFiles.has(row[1]))),
        'every ordered ordinary declaration/reference position and identity survives');
    } else if (characterPredicates || proof.dominatedPredicates || redundantGuards) {
      if (proof.dominatedPredicates || redundantGuards) for (const row of oldAudit.filter(row => row[0] === kind && changedFiles.has(row[1])))
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
  if (terminalFrames || redundantGuards || terminalTails) {
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
    if ((terminalFrames || redundantGuards) && changedFiles.has(row[1]) && !originLocations.get(row[1]).has(Number(row[2]))) return false;
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
  if (terminalFrames) {
    assert.equal(oldLabels.length - newLabels.length, proof.counts.labelsRemoved);
    for (const kind of ['B', 'N']) assert.equal(records(oldAudit).filter(row => row[0] === kind).length - records(newAudit).filter(row => row[0] === kind).length,
      kind === 'B' ? proof.terminalSwitchFrames ? proof.counts.breaksLocalized : proof.counts.breaksRemoved : proof.counts.jumpsUnlabeled);
    const positioned = (row, transform) => {
      const start = transform ? originLocations.get(row[1]).get(Number(row[2])) : Number(row[2]);
      assert.notEqual(start, undefined);
      return [row[0], row[1], start, start + Number(row[3]) - Number(row[2]), transform ? mapping.get(row[4]) : row[4], row[5]];
    };
    assert.deepEqual(records(newAudit).map(row => positioned(row, false)),
      expectedRecords.map(row => positioned(row, changedFiles.has(row[1]))), 'all retained lexical label token positions, kinds and migrated targets');
  }
  if (characterPredicates || proof.dominatedPredicates || redundantGuards) {
    const positioned = (row, transform) => {
      const location = offset => transform ? originLocations.get(row[1]).get(Number(offset)) : Number(offset);
      const start = location(row[2]), end = location(Number(row[3]) - 1);
      assert.notEqual(start, undefined); assert.notEqual(end, undefined);
      return [row[0], row[1], start, end + 1, row[4], row[5]];
    };
    assert.deepEqual(records(newAudit).map(row => positioned(row, false)),
      (redundantGuards ? expectedRecords : records(oldAudit)).map(row => positioned(row, changedFiles.has(row[1]))), 'every surviving lexical label position and target follows exact source deletions');
  }
  if (terminalTails) {
    const rules = new Map(JSON.parse(fs.readFileSync(path.join(workflowRoot, 'geoblox-rules.json'))).renames.map(rule => [rule.symbol, rule]));
    const selected = tailSelections.map(span => {
      const declarations = oldAudit.filter(row => row[0] === 'D' && row[1] === span.file && row[4].startsWith('M:')
        && Number(row[2]) >= span.methodStart && Number(row[3]) <= span.start);
      assert.equal(declarations.length, 1, 'one compiler-resolved enclosing method for each changed body');
      const symbol = declarations[0][4], owner = symbol.slice(2, symbol.indexOf('.'));
      assert.ok(rules.has(symbol) && rules.has('C:' + owner));
      return {symbol, readableMethod: rules.get('C:' + owner).to + '.' + rules.get(symbol).to, tailLines: span.tailLines};
    }).sort((a,b) => a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0);
    assert.deepEqual(selected, proof.changedMethods, 'every changed JVM method, semantic name and moved line count is independently audited');
    assert.equal(selected.reduce((total, method) => total + method.tailLines, 0), proof.hoistedTailSourceLines);
    const positioned = (row, transform) => {
      const start = transform ? originLocations.get(row[1]).get(Number(row[2])) : Number(row[2]); assert.notEqual(start, undefined);
      return [row[0], row[1], start, start + Number(row[3]) - Number(row[2]), row[4], row[5]];
    };
    assert.deepEqual(records(newAudit).map(row => positioned(row, false)), records(oldAudit).map(row => positioned(row, changedFiles.has(row[1]))),
      'every ordered lexical label declaration/reference, transfer kind and target follows the original token');
  }
  if (fieldPredicates) {
    const rules = new Map(JSON.parse(fs.readFileSync(path.join(workflowRoot, 'geoblox-rules.json'))).renames.map(rule => [rule.symbol, rule]));
    const selected = fieldPredicateSelections.map(span => {
      const declarations = oldAudit.filter(row => row[0] === 'D' && row[1] === span.file && row[4].startsWith('M:')
        && Number(row[2]) >= span.methodStart && Number(row[3]) <= span.start);
      assert.equal(declarations.length, 1, 'one independently attributed method for each field predicate body');
      const symbol = declarations[0][4], owner = symbol.slice(2, symbol.indexOf('.'));
      assert.ok(rules.has(symbol) && rules.has('C:' + owner));
      return {symbol, readableMethod: rules.get('C:' + owner).to + '.' + rules.get(symbol).to, comparisons: span.comparisons};
    }).sort((a,b) => a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0);
    assert.deepEqual(selected, proof.changedMethods, 'every affected full JVM method and comparison count');
    assert.equal(selected.reduce((sum, method) => sum + method.comparisons, 0), proof.independentlyAttributedIntegralComparisons);
  }
  if (booleanAssignments) {
    assert.equal(booleanAssignmentsProven.length, proof.independentlyAttributedBooleanAssignments);
    const selected = booleanAssignmentSelections.map(span => {
      const declarations = oldAudit.filter(row => row[0] === 'D' && row[1] === span.file && row[4].startsWith('M:') && Number(row[2]) >= span.methodStart && Number(row[3]) <= span.start);
      assert.equal(declarations.length, 1);
      return {symbol: declarations[0][4], assignments: span.booleanLocalAssignments, negatedAssignments: span.negatedAssignments};
    }).sort((a,b) => a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0);
    assert.deepEqual(selected, proof.changedMethods, 'every affected full JVM method and Boolean assignment count');
  }
  if (nestedDispatch) {
    assert.equal(independentlyAttributedClassifierReads, proof.counts.primitiveComparisonsRemoved);
    const selected = dispatchSelections.map(span => {
      const declarations = oldAudit.filter(row => row[0] === 'D' && row[1] === span.file && row[4].startsWith('M:')
        && Number(row[2]) >= span.methodStart && Number(row[3]) <= span.start);
      assert.equal(declarations.length, 1, 'one enclosing full JVM method');
      return {symbol: declarations[0][4], ...(switchPrefixes ? {switchesExtended: span.scalarSwitchPrefixes} : {dispatches: span.scalarIfDispatches}), comparisons: span.primitiveComparisonsRemoved};
    }).sort((a,b) => a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0);
    assert.deepEqual(selected, proof.changedMethods, 'every affected method and independently attributed classifier count');
  }
  if (terminalTails || fieldPredicates || grouping || nestedDispatch || booleanAssignments) {
    const nextRows = run('java', ['-cp', helpers, 'GeobloxBodyPositions', after, stubs, 'tails']).toString().trim().split('\n').map(line => line.split('\t')).filter(row => row[0] === 'Q');
    assert.equal(oldTransferEvidence.length, proof.independentlyComparedTransferFacts);
    assert.equal(nextRows.length, oldTransferEvidence.length + (nestedDispatch ? proof.counts.bareSwitchExitsAdded : 0));
    const facts = (rows, before) => rows.map(row => {
      const changed = before && changedFiles.has(row[1]);
      const position = offset => {const value = changed ? originLocations.get(row[1]).get(Number(offset)) : Number(offset);assert.notEqual(value, undefined, 'transfer/target/scope origin survives');return value;};
      const scopes = (row[9] || '').split(',').filter(Boolean).map(scope => {const [kind, role, start] = scope.split(':');return [kind, role, position(start)];});
      return [row[1], position(row[2]), position(Number(row[3]) - 1) + 1, row[4], row[5], row[6], position(row[7]), position(Number(row[8]) - 1) + 1, scopes];
    }).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]);
    const expected = facts(oldTransferEvidence, true);
    let retained = nextRows;
    if (nestedDispatch) {
      const starts = new Set(expected.map(row => row[0] + ':' + row[1]));
      retained = nextRows.filter(row => starts.has(row[1] + ':' + row[2]));
      const added = nextRows.filter(row => !starts.has(row[1] + ':' + row[2]));
      assert.equal(added.length, proof.counts.bareSwitchExitsAdded);
      assert.ok(added.every(row => row[4] === 'BREAK' && row[5] === '' && row[6] === 'SWITCH'), 'only proven new bare switch exits are introduced');
    }
    assert.deepEqual(facts(retained, false), expected, 'all original bare/named break/continue/return/throw targets and try/catch/finally/monitor identities remain exact');
    assert.equal(new Set(nextRows.map(row => row[1] + ':' + row[2])).size, nextRows.length, 'unique complete transfer evidence');
  }
  if (grouping) {
    const selected = groupingSelections.map(span => {
      const declarations = oldAudit.filter(row => row[0] === 'D' && row[1] === span.file && row[4].startsWith('M:')
        && Number(row[2]) >= span.methodStart && Number(row[3]) <= span.start);
      if (!declarations.length) {assert.ok(!Number.isFinite(span.methodStart), 'only initializer spans lack a method declaration');return null;}
      assert.equal(declarations.length, 1);
      const symbol = declarations[0][4], method = proof.largeLabeledBodiesAfter.inventory.find(item => 'M:' + item.enclosingMethod === symbol);
      return method ? {symbol, readableMethod: method.file.slice(0, -5) + '.' + method.method,
        conditions: span.conditionsSimplified, pairs: span.parenthesisPairsRemoved} : null;
    }).filter(Boolean).sort((a,b) => a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0);
    assert.deepEqual(selected, proof.highlightedMethods, 'full JVM identities and cleanup counts for every remaining large labeled body');
    const nextAst = run('java', ['-cp', helpers, 'GeobloxBodyPositions', after, stubs, 'grouping']).toString().trim().split('\n').map(line => line.split('\t')).filter(row => row[0] === 'A');
    const oldAst = positionRows.filter(row => row[0] === 'A');assert.equal(oldAst.length, 303);assert.equal(nextAst.length, 303);
    assert.deepEqual(nextAst, oldAst, 'independent JDK complete AST equality modulo parentheses: no reassociation, operator, boxing/cast, call or statement changes');
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
    if (proof.terminalPrefixBreaks || proof.scalarIfDispatches || characterPredicates || proof.dominatedPredicates || redundantGuards || terminalFrames || terminalTails || booleanAssignments) {
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
    counts, ...(booleanAssignments ? {independentlyAttributedBooleanAssignments: booleanAssignmentsProven.length, duplicateLocalWriteOccurrencesRemoved: removedBooleanWrites.size, survivingPerOccurrenceJavaAndLabelBindingsPreserved: true, allTransferTargetsAndProtectedScopesPreserved: true, independentJdkTransferAndScopeEvidence: true, exactExpectedSourceBytes: true} : {}), ...(nestedDispatch ? {independentlyAttributedClassifierReads, capturedLocalsUnmodifiedInDispatch: true, independentlyEncodedUtf16Units: 393216, allOriginalTransferTargetsAndProtectedScopesPreserved: true, independentJdkTransferAndScopeEvidence: true, exactExpectedSourceBytes: true} : {}), ...(grouping ? {completeJavaAstModuloParenthesesPreserved: true, independentlyComparedAstFiles: 303} : {}), ...(proof.dominatedPredicates ? {independentlyProvenGuardComparisons: removedGuardReads.size} : {}), ...(proof.integralPredicates ? {independentlyAttributedIntegralComparisons: counts.relationalComplements} : {}), labelBindings: actualLabels.length, survivingLabelOrdinalMigrations: migrations, sourceArchiveSha256: proof.sourceArchiveSha256, exactExpectedTokenStreams: true,
    orderedJavaDeclarationsUnchanged: true, ...((terminalTails || fieldPredicates || grouping || booleanAssignments) ? {survivingPerOccurrenceJavaAndLabelBindingsPreserved: true, allTransferTargetsAndProtectedScopesPreserved: true, independentJdkTransferAndScopeEvidence: true, exactExpectedSourceBytes: true} : redundantGuards ? {survivingPerOccurrenceJavaAndLabelBindingsPreserved: true, independentJdkPureGuardAndDestinationEvidence: true, purePrimitiveReadsRemoved: removedGuardReads.size, exactExpectedSourceBytes: true} : terminalFrames ? {survivingPerOccurrenceJavaAndLabelBindingsPreserved: true, independentJdkTransferAndScopeEvidence: true, exactExpectedSourceBytes: true} : proof.dominatedPredicates ? {survivingPerOccurrenceJavaAndLabelBindingsPreserved: true, purePrimitiveReadsRemoved: removedGuardReads.size, exactExpectedSourceBytes: true} : characterPredicates ? {perOccurrenceJavaAndLabelBindingsPreserved: true, exactExpectedSourceBytes: true} : proof.scalarIfDispatches ? {survivingPerOccurrenceJavaBindingsPreserved: true, purePrimitiveReadsRemoved: proof.primitiveReferenceOccurrencesRemoved}
      : (proof.loopElseExitGuards || proof.terminalPrefixBreaks) ? {perOccurrenceJavaBindingsPreserved: true} : {orderedJavaBindingsUnchanged: true})}));
} finally {
  fs.rmSync(temporary, {recursive: true, force: true});
}
