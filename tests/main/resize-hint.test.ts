import{describe,it,expect}from'vitest';
import{resizeHint}from'../../src/main/resize-hint';
describe('resize direction hint',()=>{
  const b={x:100,y:100,width:300,height:182};
  it('indicates both straight edge directions and clamps hint inside the surface',()=>{
    expect(resizeHint(b,{x:398,y:190})).toEqual({x:280,y:90,direction:'ew',edges:['right']});
    expect(resizeHint(b,{x:250,y:102})).toEqual({x:150,y:20,direction:'ns',edges:['top']});
  });
  it('scales corner hit regions with the visible rounded corner',()=>{
    const h=resizeHint({x:100,y:100,width:450,height:273},{x:538,y:361});
    expect(h?.direction).toBe('nwse');expect(h?.edges).toEqual(['right','bottom']);
    expect(resizeHint(b,{x:102,y:280})?.direction).toBe('nesw');
  });
  it('leaves centre and outside inputs without hints',()=>{
    expect(resizeHint(b,{x:250,y:190})).toBeNull();expect(resizeHint(b,{x:401,y:190})).toBeNull();
  });
});
