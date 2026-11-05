import json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
old=json.loads(pathlib.Path('/mnt/data/abyssal-erosion/data/monsters.json').read_text())
abilities={
 'regret':dict(id='grasp',label='Grasp of What Was',kind='save',defense='reflex',dc=32,track='identity',erosion=dict(criticalFailure=2,failure=1),conditionOnCriticalFailure='immobilized',note='30 ft. Immobilized until end of next turn; Escape DC 32; manage expiration manually.'),
 'hollow':dict(id='suffocation',label='Existential Suffocation',kind='save',defense='fortitude',dc=34,track='identity',erosion=dict(criticalFailure=2,failure=1),conditionOnCriticalFailure='fatigued',note='30-ft emanation, one target. Fatigued until end of encounter; manage expiration manually.'),
 'mirror':dict(id='reflection',label='The Perfect Reflection',kind='skill-vs-perception',skill='deception',track='identity',erosion=dict(criticalSuccess=2,success=1),note='Deception vs target Perception DC. On critical failure, Mirror becomes off-guard to target until next turn (GM manages).')
}
adv=[]
for raw, id in zip(old,['regret','hollow','mirror']):
 raw['flags']={'kiragon-homebrew':{'pack':'abyssal-erosion','adversary':id}}
 adv.append(dict(id=id,actor=raw,abilities=[abilities[id]]))
pack={
 'schema':1,'id':'abyssal-erosion','name':'Abyssal Erosion — Emotion & Humanity','version':'1.1.0',
 'description':'The Abyss amplifies the key attribute while eroding a Will-based humanity pool. Nine real-world bells lead to severance. Monsters attack the remaining pool instead of HP.',
 'clocks':[{'id':'severance','label':'Severance Clock','minutes':90,'bells':9,'pauseDuringCombat':True,'combatCostMinutes':5}],
 'tracks':[{'id':'identity','label':'Identity (Will)','source':'actor-will','terminalLabel':'Lost to the Abyss','normalLabel':'Human','clock':{'id':'severance','loss':'fractional','fraction':1},
    'tiers':[{'atOrBelow':0.75,'label':'Heightened','power':1},{'atOrBelow':0.5,'label':'Extreme','power':2},{'atOrBelow':0.25,'label':'Near-demonic','power':3}],
    'effects':[{'kind':'flat-modifier','selector':'will','basedOn':'missing','multiplier':-1,'type':'untyped','label':'Erosion — Loss of Identity'},
               {'kind':'key-attribute','basedOn':'power','label':'Emotional Polarization'}],
    'themes':{'str':{'name':'Wrath / Exhilaration','surge':'Overpower, break, attack','crash':'Humiliation or thwarted aggression'},
              'dex':{'name':'Exhilaration / Terror','surge':'Dodge, evade, outpace','crash':'Entrapment, vulnerability, pursuit'},
              'con':{'name':'Invincibility / Emptiness','surge':'Endure, remain unbroken','crash':'Apathy, loss of connection'},
              'int':{'name':'Revelation / Obsession','surge':'Deduce, understand, solve','crash':'Uncertainty, unfinished questions'},
              'wis':{'name':'Ecstasy / Despair','surge':'Empathize, perceive, heal','crash':'Witnessed suffering, loss of hope'},
              'cha':{'name':'Adoration / Rejection','surge':'Inspire, compel, enchant','crash':'Being ignored, rejected, abandoned'}}}],
 'actions':[
  {'id':'erode-1','label':'+1 Erosion','kind':'adjust','track':'identity','amount':-1,'gmOnly':True,'description':'Drain 1 remaining identity.'},
  {'id':'erode-2','label':'+2 Erosion','kind':'adjust','track':'identity','amount':-2,'gmOnly':True,'description':'Drain 2 remaining identity.'},
  {'id':'restore-1','label':'Restore 1 Will','kind':'adjust','track':'identity','amount':1,'gmOnly':True,'description':'GM restoration.'},
  {'id':'rupture-resist','label':'Rupture: Resist','kind':'rupture','track':'identity','costByTier':[0,1,2,3,3],'once':'encounter-or-bell','requiresTier':1,'group':'rupture','description':'Resist emotion at a cost equal to current polarization tier.'},
  {'id':'rupture-indulge','label':'Rupture: Indulge','kind':'announce','track':'identity','once':'encounter-or-bell','requiresTier':1,'group':'rupture','description':'Indulge the dominant emotion: no immediate Erosion, but roleplay consequences.'},
  {'id':'overdrive','label':'Emotional Overdrive','kind':'overdrive','track':'identity','amount':-1,'once':'encounter-or-bell','requiresTier':1,'bonus':{'selector':'attack','type':'circumstance','value':1,'removeAfterRoll':True},'description':'Spend 1 Erosion; +1 circumstance bonus to next attack roll. Selector can be changed in the JSON editor.'},
  {'id':'reject','label':'Reject the Abyss','kind':'surrender','track':'identity','restore':2,'surrender':1,'once':'expedition','requiresTier':1,'description':'Forfeit a point of polarization for the remainder of the expedition to restore 2 Will.'}
 ],
 'adversaries':adv
}
(ROOT/'packs/abyssal-erosion.json').write_text(json.dumps(pack,ensure_ascii=False,indent=2)+'\n')
example={
 'schema':1,'id':'fate-scars-example','name':'Fate Scars (Editable Example)','version':'0.1.0','description':'Example homebrew: 8 Fate points and a four-bell ritual. Safe to customize; does not alter the character sheet.',
 'clocks':[{'id':'ritual','label':'Fate Ritual','minutes':40,'bells':4,'pauseDuringCombat':False,'combatCostMinutes':0}],
 'tracks':[{'id':'fate','label':'Fate Reserve','source':'fixed','initial':8,'terminalLabel':'Fate Severed','normalLabel':'Intact',
            'clock':{'id':'ritual','loss':'fractional','fraction':0.5},'tiers':[{'atOrBelow':0.5,'label':'Strained','power':0},{'atOrBelow':0.25,'label':'Fractured','power':0}], 'effects':[]}],
 'actions':[{'id':'spend-fate','label':'Spend 1 Fate','kind':'adjust','track':'fate','amount':-1},
            {'id':'restore-fate','label':'Restore 1 Fate','kind':'adjust','track':'fate','amount':1},
            {'id':'fate-omen','label':'Read an Omen','kind':'announce','track':'fate','description':'The GM describes a possible consequence of the future.'}],
 'adversaries':[],
 'items':[{'id':'fate-scar-effect','document':{'name':'Fate Scar (Example Effect)','type':'effect','img':'icons/magic/control/debuff-energy-hold-blue.webp',
          'system':{'description':{'value':'<p>Example effect: -1 status penalty to Will. Edit this PF2e item after import.</p>'},
                    'duration':{'value':-1,'unit':'unlimited','sustained':False},'traits':{'value':[]},
                    'rules':[{'key':'FlatModifier','selector':'will','type':'status','value':-1}]}}}]
}
(ROOT/'packs/fate-scars-example.json').write_text(json.dumps(example,indent=2)+'\n')
