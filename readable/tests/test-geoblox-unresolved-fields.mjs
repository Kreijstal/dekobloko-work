import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {funorbRepository, manifestFile} from '../layout.mjs';
import {sourceInventory, sourceIdentity} from '../tools/readable-java.mjs';
import {captureProcess} from '../tools/lib/capture-process.mjs';

// Verify the source observations behind the remaining purpose inventory.
// Neither lack of ordinary references nor merge-only access establishes a
// runtime purpose: reflection, native code and other artifacts remain outside
// this certificate. No field is removed or assigned an inferred UI role.
const preview = process.argv.includes('--preview');
assert.ok(process.argv.slice(2).every(arg => arg === '--preview'));
const manifest = JSON.parse(fs.readFileSync(manifestFile));
const rules = manifest.renames.filter(rule => rule.symbol.startsWith('F:') &&
  /(?:functional purpose|specific rendering\/property meaning) remains unresolved/.test(rule.evidence));
assert.equal(rules.length, 41);
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'geoblox-field-purposes-'));
const run = (command, args) => captureProcess(command, args, {maxBuffer: 128 * 1024 * 1024}).stdout.toString();
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
try {
  if (!preview) {
    const provenance = JSON.parse(fs.readFileSync(path.join(funorbRepository, 'decompilation/geoblox-provenance.json')));
    const proof = provenance.spriteDirectionAndAlphaPurposeNaming?.unresolvedFieldSourceAudit;
    assert.ok(proof, 'recorded field-purpose source audit required');
    assert.equal(hash(fs.readFileSync(new URL(import.meta.url))), proof.fixtureSha256);
    assert.equal(manifest.source.commit, proof.sourceCommit);
    assert.equal(manifest.inputTreeSha256, proof.sourceTreeSha256);
  }
  const archive = path.join(directory, 'source.tar');
  run('git', ['-C', funorbRepository, 'archive', '--format=tar', '--output=' + archive,
    manifest.source.commit, manifest.source.subdirectory]);
  run('tar', ['-xf', archive, '-C', directory]);
  const input = path.join(directory, manifest.source.subdirectory);
  const files = sourceInventory(input);
  assert.equal(files.length, 303);
  assert.equal(sourceIdentity(files), manifest.inputTreeSha256);
  const list = path.join(directory, 'sources.txt');
  fs.writeFileSync(list, files.map(file => file.path).join('\n') + '\n');
  const wanted = path.join(directory, 'fields.txt');
  fs.writeFileSync(wanted, rules.map(rule => rule.symbol).join('\n') + '\n');
  const helper = path.join(directory, 'FieldPurposeFacts.java');
  fs.writeFileSync(helper, `import java.io.*;import java.nio.file.*;import java.util.*;
import javax.tools.*;import javax.lang.model.element.*;import javax.lang.model.type.*;
import com.sun.source.tree.*;import com.sun.source.util.*;
public class FieldPurposeFacts {
 static String type(TypeMirror t){switch(t.getKind()){
 case BOOLEAN:return "Z";case BYTE:return "B";case CHAR:return "C";case SHORT:return "S";
 case INT:return "I";case LONG:return "J";case FLOAT:return "F";case DOUBLE:return "D";
 case VOID:return "V";case ARRAY:return "["+type(((ArrayType)t).getComponentType());
 case DECLARED:return "L"+((TypeElement)((DeclaredType)t).asElement()).getQualifiedName().toString().replace('.','/')+";";
 default:throw new AssertionError(t);}}
 static String field(VariableElement e){return "F:"+e.getEnclosingElement()+"."+e.getSimpleName()+":"+type(e.asType());}
 static String method(ExecutableElement e){StringBuilder s=new StringBuilder(e.getEnclosingElement()+"."+e.getSimpleName()+"(");for(VariableElement p:e.getParameters())s.append(type(p.asType()));return s.append(")").append(type(e.getReturnType())).toString();}
 public static void main(String[] args)throws Exception {
  Path root=Paths.get(args[0]);Set<String> wanted=new HashSet<>(Files.readAllLines(Paths.get(args[3])));
  List<File> files=new ArrayList<>();for(String name:Files.readAllLines(Paths.get(args[1])))files.add(root.resolve(name).toFile());
  JavaCompiler compiler=ToolProvider.getSystemJavaCompiler();DiagnosticCollector<JavaFileObject> errors=new DiagnosticCollector<>();
  try(StandardJavaFileManager fm=compiler.getStandardFileManager(errors,null,null)){
   JavacTask task=(JavacTask)compiler.getTask(null,fm,errors,Arrays.asList("--release","8","-proc:none","-encoding","UTF-8","-sourcepath","","-classpath",args[2]),null,fm.getJavaFileObjectsFromFiles(files));
   List<CompilationUnitTree> units=new ArrayList<>();for(CompilationUnitTree unit:task.parse())units.add(unit);task.analyze();
   for(Diagnostic<?> diagnostic:errors.getDiagnostics())if(diagnostic.getKind()==Diagnostic.Kind.ERROR)throw new AssertionError(diagnostic.toString());
   Trees trees=Trees.instance(task);SourcePositions positions=trees.getSourcePositions();
   for(CompilationUnitTree unit:units){String file=root.relativize(Paths.get(unit.getSourceFile().toUri())).toString();new TreePathScanner<Void,Void>(){
    @Override public Void visitVariable(VariableTree node,Void unused){Element e=trees.getElement(getCurrentPath());
     if(e instanceof VariableElement&&e.getKind()==ElementKind.FIELD&&wanted.contains(field((VariableElement)e)))
      System.out.println("D\\t"+field((VariableElement)e)+"\\t"+file+"\\t"+String.join(",",e.getModifiers().stream().map(Object::toString).sorted().toArray(String[]::new))+"\\t"+(node.getInitializer()!=null));
     return super.visitVariable(node,unused);}
    void reference(Tree node){Element e=trees.getElement(getCurrentPath());if(!(e instanceof VariableElement)||e.getKind()!=ElementKind.FIELD||!wanted.contains(field((VariableElement)e)))return;
     String owner="<initializer>";for(TreePath p=getCurrentPath().getParentPath();p!=null;p=p.getParentPath())if(p.getLeaf() instanceof MethodTree){owner=method((ExecutableElement)trees.getElement(p));break;}
     Tree parent=getCurrentPath().getParentPath().getLeaf();String access="read";
     if(parent instanceof AssignmentTree&&((AssignmentTree)parent).getVariable()==node)access="write";
     else if(parent instanceof CompoundAssignmentTree&&((CompoundAssignmentTree)parent).getVariable()==node)access="read-write";
     else if(parent instanceof UnaryTree&&EnumSet.of(Tree.Kind.PREFIX_INCREMENT,Tree.Kind.PREFIX_DECREMENT,Tree.Kind.POSTFIX_INCREMENT,Tree.Kind.POSTFIX_DECREMENT).contains(parent.getKind()))access="read-write";
     System.out.println("R\\t"+field((VariableElement)e)+"\\t"+file+"\\t"+positions.getStartPosition(unit,node)+"\\t"+owner+"\\t"+access);}
    @Override public Void visitIdentifier(IdentifierTree node,Void unused){reference(node);return super.visitIdentifier(node,unused);}
    @Override public Void visitMemberSelect(MemberSelectTree node,Void unused){reference(node);return super.visitMemberSelect(node,unused);}
   }.scan(unit,null);}
  }
 }
}`);
  run('javac', ['-d', directory, helper]);
  const facts = run('java', ['-cp', directory, 'FieldPurposeFacts', input, list,
    path.join(funorbRepository, 'readable/funorb-stubs.jar'), wanted]).trim().split('\n').map(line => line.split('\t'));
  const inventory = rules.map(rule => {
    const declarations = facts.filter(row => row[0] === 'D' && row[1] === rule.symbol);
    assert.equal(declarations.length, 1, rule.symbol + ' one resolved field');
    const declaration = declarations[0], references = facts.filter(row => row[0] === 'R' && row[1] === rule.symbol);
    const modifiers = declaration[3].split(',');
    assert.equal(declaration[4], 'false', rule.symbol + ' no field-declaration initializer');
    const kind = rule.symbol.startsWith('F:ch.') ? 'no-ordinary-source-references' : 'constructor-and-merge-only';
    if (kind === 'no-ordinary-source-references') {
      assert.ok(modifiers.includes('public') && modifiers.includes('static'));
      assert.equal(references.length, 0);
    } else {
      assert.ok(rule.symbol.startsWith('F:mi.') && modifiers.includes('private'));
      assert.ok(references.length > 0);
      for (const reference of references) assert.ok(reference[4].startsWith('mi.<init>(') ||
        reference[4] === 'mi.a(ILmi;)V', rule.symbol + ' original constructor/merge owner');
    }
    return {symbol: rule.symbol, name: rule.to, file: declaration[2], sourceSha256: hash(fs.readFileSync(path.join(input, declaration[2]))),
      modifiers, observation: kind, references: references.length,
      owners: [...new Set(references.map(row => row[4]))].sort(),
      reads: references.filter(row => row[5] !== 'write').length,
      writes: references.filter(row => row[5] !== 'read').length};
  }).sort((a, b) => a.symbol.localeCompare(b.symbol));
  assert.equal(inventory.filter(field => field.observation === 'no-ordinary-source-references').length, 6);
  assert.equal(inventory.filter(field => field.observation === 'constructor-and-merge-only').length, 35);
  if (!preview) assert.deepEqual(inventory, manifest.publication.verification.unresolvedFieldPurposeInventory);
  console.log(JSON.stringify({sourceCommit: manifest.source.commit, sourceTreeSha256: manifest.inputTreeSha256,
    compiledSourceFiles: files.length, unresolvedFieldPurposes: inventory.length,
    publicFieldsWithoutOrdinaryReferences: 6, privateConstructorMergeOnlyFields: 35, inventory}));
} finally {
  fs.rmSync(directory, {recursive: true, force: true});
}
