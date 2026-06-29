import numpy as np, json

P = dict(K=100000, N0=200, p=0.01, r=0.35, chi_min=0.02, chi_max=0.35,
         kappa=12, m0=8, dm_shock=4, phi=0.35, sigma=0.12, c_ac=15,
         F=30000, tau=6, t_shock=16, T=54)
SEED=12345
T=P['T']; STEPS=361
t=np.linspace(0,T,STEPS)
dt=t[1]-t[0]
strategies=[("Open",0.3),("Hybrid",0.6),("Frontier",0.9)]
qstar_grid=[round(0.10+0.02*k,2) for k in range(46)]

def chi(Q,Qs):
    return P['chi_min']+(P['chi_max']-P['chi_min'])/(1+np.exp(P['kappa']*(Q-Qs)))

def simulate(Q,Qs,noise=None):
    N=np.empty(STEPS); N[0]=P['N0']
    ch=chi(Q,Qs)
    for i in range(1,STEPS):
        ti=t[i-1]; n=N[i-1]
        comp=P['phi']*ti/T
        dN=(P['p']*(P['K']-n)+P['r']*n*(1-n/P['K'])-ch*n-comp*n)
        if noise is not None:
            dN=dN*(1+P['sigma']*noise[i-1])
        n2=n+dN*dt
        N[i]=max(n2,0)
    return N

N=np.zeros((3,46,STEPS))
N_samples=np.zeros((3,46,10,STEPS))
rng=np.random.default_rng(SEED)
for s,(lbl,Q) in enumerate(strategies):
    for qi,Qs in enumerate(qstar_grid):
        N[s,qi]=simulate(Q,Qs)
        for k in range(10):
            noise=rng.standard_normal(STEPS)
            N_samples[s,qi,k]=simulate(Q,Qs,noise)

# sanity at dm=6, Qs=0.5
def profit_curve(s,Qs,dm):
    qi=qstar_grid.index(round(Qs,2))
    Narr=N[s,qi]; Q=strategies[s][1]
    gate=(t>=P['tau']).astype(float)
    shock=(t>=P['t_shock']).astype(float)
    comp=P['phi']*t/T
    ch=chi(Q,Qs)
    m=P['m0']+dm*Q
    om=gate*(m-P['dm_shock']*shock)*Narr
    cost=P['c_ac']*(ch+comp)*Narr+P['F']
    return om-cost

for s,(lbl,Q) in enumerate(strategies):
    pr=profit_curve(s,0.5,6)
    cum=np.trapezoid(pr,t)
    print(lbl, f"{cum/1e6:.2f}M")

out=dict(
  meta=dict(
    params=P,
    controls=dict(
      dm=dict(min=0,max=12,default=6,step=0.5,label="Δm — margin slope ($/user/step per unit quality)"),
      qstar=dict(default=0.5,label="Q* — churn quality threshold")
    ),
    strategies=[dict(label=l,Q=q) for l,q in strategies]
  ),
  t=[round(float(x),4) for x in t],
  qstar_grid=qstar_grid,
  N=np.rint(N).astype(int).tolist(),
  N_samples=np.rint(N_samples).astype(int).tolist()
)
with open('/tmp/runs.json','w') as f:
    json.dump(out,f)
print("written", )
