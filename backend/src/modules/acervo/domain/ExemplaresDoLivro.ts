export interface ExemplaresDoLivro {
  existemPara(livroId: number): Promise<boolean>;
}
