/**
 * python-pptx-wasm は番号付きリスト（ordered list）の API を直接提供していないため、
 * Pyodide 経由で lxml を操作し、段落プロパティ（a:pPr）に a:buAutoNum 要素を追加する。
 */

const PYTHON_HELPER = `
from lxml import etree
from pptx.oxml.ns import qn

def _md_pptx_add_buAutoNum(packed_id, num_type="arabicPeriod"):
    s, o, p = _parse_packed_id(packed_id)
    pPr = _get(s, o, p)
    for tag in [qn('a:buNone'), qn('a:buChar'), qn('a:buAutoNum')]:
        for child in pPr.findall(tag):
            pPr.remove(child)
    buAutoNum = etree.SubElement(pPr, qn('a:buAutoNum'))
    buAutoNum.set('type', num_type)
`;

export interface PyodideLike {
  runPython(code: string): void;
  globals: { get(name: string): (...args: unknown[]) => unknown };
}

/**
 * Pyodide インスタンスから番号付きリスト用のヘルパー関数を作成する。
 * 返された関数は、段落プロパティ要素の packed_id を受け取り、
 * a:buAutoNum 要素を追加する。
 */
export function createOrderedListHelper(
  pyodide: PyodideLike,
): (pPrPackedId: string) => void {
  pyodide.runPython(PYTHON_HELPER);
  const addBuAutoNum = pyodide.globals.get("_md_pptx_add_buAutoNum");
  return (pPrPackedId: string) => {
    addBuAutoNum(pPrPackedId, "arabicPeriod");
  };
}
