/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { WorldData, ClassDefinition, GameData, Instance, Layer } from '../../game/core/WorldData';

interface TreeNode {
  classDef: ClassDefinition;
  name: string;
  children: TreeNode[];
  expanded: boolean;
}

@Component({
  selector: 'app-debug',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './debug.component.html',
  styleUrl: './debug.component.css'
})
export class DebugComponent implements OnInit {
  worldData: WorldData;
  isLoading = true;
  error: string | null = null;

  classTree: TreeNode[] = [];

  selectedClassId: string | null = null;
  selectedClassHierarchy: ClassDefinition[] = [];
  resolvedProperties: any = null;
  resolvedBehaviours: any[] = [];
  rawConfig: any = null;
  selectedClassImageUrl: string | null = null;
  relatedInstances: { layoutId: string, layerId: string, instance: Instance, layer: Layer }[] = [];
  selectedInstance: any = null;

  constructor(private http: HttpClient) {
    this.worldData = new WorldData();
  }

  ngOnInit() {
    this.http.get<GameData>('assets/gamedata/game.json').subscribe({
      next: (data) => {
        this.worldData.loadWorldData(data);
        this.buildClassTree();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load game data', err);
        this.error = 'Failed to load game data: ' + err.message;
        this.isLoading = false;
      }
    });
  }

  get classes(): ClassDefinition[] {
    return this.worldData?.getData()?.game.classes || [];
  }

  private resolveTextureUrl(props: any): string | null {
      if (props && props['image']) {
          const filename = this.worldData.getTextureFile(props['image']);
          if (filename) {
              return 'assets/gamedata/' + filename;
          }
      }
      return null;
  }

  selectInstance(instData: { layoutId: string, layerId: string, instance: Instance, layer: Layer }) {
      const instance = instData.instance;
      const props = this.worldData.resolveInstanceProperties(instance, instData.layer);
      
      this.selectedInstance = {
          id: instance.id,
          inherit: instance.inherit,
          layoutId: instData.layoutId,
          layerId: instData.layerId,
          properties: props,
          imageUrl: this.resolveTextureUrl(props),
          behaviours: this.worldData.resolveInstanceBehaviours(instance),
          animations: this.worldData.resolveInstanceAnimations(instance).map(anim => ({
              id: anim.id,
              config: this.worldData.unwrapConfig(anim.config),
              frames: (anim.frames || []).map(f => {
                  const fProps = this.worldData.unwrapConfig(f.config);
                  return {
                      id: f.id,
                      config: fProps,
                      imageUrl: this.resolveTextureUrl(fProps)
                  };
              })
          }))
      };
  }


  buildClassTree() {
    const classMap = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    // 1. Create all nodes
    this.classes.forEach(cls => {
      const configName = this.worldData.unwrapConfig(cls.config)['name'];
      const name = configName ? configName : cls.id;
      
      classMap.set(cls.id, {
        classDef: cls,
        name: name,
        children: [],
        expanded: true
      });
    });

    // 2. Link children to parents
    classMap.forEach(node => {
      const cls = node.classDef;
      if (cls.inherit) {
        // Handle multiple inheritance or single inheritance
        // Assuming primarily single parent for tree structure, or just taking the first one
        // If it starts with 'intrinsic:', we treat it as a root for our purposes 
        // (unless we want to create intrinsic nodes too, but they aren't in the class list usually)
        
        const parents = cls.inherit.split(',').map(s => s.trim()).filter(s => s);
        let validParentFound = false;

        for (const parentId of parents) {
           if (parentId.startsWith('intrinsic:')) continue;
           
           const parentNode = classMap.get(parentId);
           if (parentNode) {
             parentNode.children.push(node);
             validParentFound = true;
             // If we want to support showing the node under ALL parents (DAG), we don't break.
             // But for a simple tree view, usually we pick the first valid parent.
             // Let's stick to first valid parent for now to avoid duplication in UI.
             break; 
           }
        }

        if (!validParentFound) {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    // 3. Sort roots and children by name for better readability
    const sortNodes = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      nodes.forEach(n => sortNodes(n.children));
    };
    sortNodes(roots);

    this.classTree = roots;
  }

  toggleNode(node: TreeNode, event: Event) {
    event.stopPropagation();
    node.expanded = !node.expanded;
  }

  selectClass(classId: string) {
    this.selectedInstance = null;
    this.selectedClassId = classId;
    const cls = this.worldData.getClass(classId);
    
    if (cls) {
      this.selectedClassHierarchy = this.worldData.getClassHierarchy(classId);
      this.resolvedProperties = this.worldData.resolveClassProperties(classId);
      this.rawConfig = this.worldData.unwrapConfig(cls.config);
      this.selectedClassImageUrl = this.resolveTextureUrl(this.resolvedProperties);
      
      const behavioursMap = this.worldData.resolveClassBehaviours(classId);
      this.resolvedBehaviours = Array.from(behavioursMap.entries()).map(([id, config]) => ({ id, config }));

      // Find instances
      this.relatedInstances = [];
      const data = this.worldData.getData();
      if (data?.game.layouts) {
        for (const layout of data.game.layouts) {
            const layoutName = this.worldData.unwrapConfig(layout.config)['name'] || layout.id;
            for (const layer of layout.layers) {
                const layerName = this.worldData.unwrapConfig(layer.config)['name'] || layer.id;
                if (layer.instances) {
                    for (const instance of layer.instances) {
                         const hierarchy = this.worldData.getClassHierarchy(instance.inherit);
                         if (hierarchy.some(c => c.id === classId)) {
                             this.relatedInstances.push({
                                 layoutId: layoutName,
                                 layerId: layerName,
                                 instance: instance,
                                 layer: layer
                             });
                         }
                    }
                }
            }
        }
      }
    }
  }
}